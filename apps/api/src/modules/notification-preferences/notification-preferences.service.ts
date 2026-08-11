import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

// ─── Channel type ────────────────────────────────────────────────────────────

export type DeliveryChannel = "both" | "email" | "inapp" | "off";

const VALID_CHANNELS: DeliveryChannel[] = ["both", "email", "inapp", "off"];

// ─── Intersection helper (SLICE 5: mute-only semantics) ─────────────────────

/**
 * Resolve the effective delivery channel for a specific user + trigger.
 *
 * Semantics: MUTE-ONLY / NARROW. A user preference can only reduce channels,
 * never add. Effective = adminChannels ∩ userChannels.
 *
 * Channel → channel-set mapping:
 *   "both"  → {email, inapp}
 *   "email" → {email}
 *   "inapp" → {inapp}
 *   "off"   → {}
 *
 * Intersection rules (admin × user → effective):
 *   both  × both  → both
 *   both  × email → email
 *   both  × inapp → inapp
 *   both  × off   → off
 *   email × both  → email   (user cannot add inapp)
 *   email × email → email
 *   email × inapp → off     (no overlap)
 *   email × off   → off
 *   inapp × both  → inapp   (user cannot add email)
 *   inapp × email → off     (no overlap)
 *   inapp × inapp → inapp
 *   inapp × off   → off
 *   off   × *     → off     (admin disabled this channel entirely)
 *
 * A null userChannel (no stored pref) returns adminDeliveryMethod unchanged.
 *
 * @param adminDeliveryMethod The trigger's configured deliveryMethod.
 * @param userChannel The user's stored channel preference, or null to inherit.
 * @returns The effective channel for this user+trigger combination.
 */
export function resolveEffectiveChannel(
  adminDeliveryMethod: DeliveryChannel,
  userChannel: DeliveryChannel | null
): DeliveryChannel {
  if (!userChannel) return adminDeliveryMethod;

  const adminHasEmail = adminDeliveryMethod === "both" || adminDeliveryMethod === "email";
  const adminHasInapp = adminDeliveryMethod === "both" || adminDeliveryMethod === "inapp";
  const userWantsEmail = userChannel === "both" || userChannel === "email";
  const userWantsInapp = userChannel === "both" || userChannel === "inapp";

  const effectiveEmail = adminHasEmail && userWantsEmail;
  const effectiveInapp = adminHasInapp && userWantsInapp;

  if (effectiveEmail && effectiveInapp) return "both";
  if (effectiveEmail) return "email";
  if (effectiveInapp) return "inapp";
  return "off";
}

// ─── Eligibility check ───────────────────────────────────────────────────────

/**
 * Determine whether a user (by id) is eligible for a given trigger config.
 *
 * Eligibility rules (mirrors admin-side recipient resolution):
 *   - trigger must be `isEnabled`
 *   - caller matches `recipientUserIds` (explicit id list), OR
 *   - caller has a role whose name is in `recipientRoles`.
 */
function isEligible(
  userId: string,
  userRoleNames: string[],
  trigger: {
    isEnabled: boolean;
    recipientUserIds: string[];
    recipientRoles: string[];
  }
): boolean {
  if (!trigger.isEnabled) return false;
  if (trigger.recipientUserIds.includes(userId)) return true;
  return userRoleNames.some((name) => trigger.recipientRoles.includes(name));
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class NotificationPreferencesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List all triggers the caller is eligible for, each with:
   *   - trigger key + admin label + description
   *   - adminDeliveryMethod (admin's configured deliveryMethod)
   *   - storedChannel (caller's stored preference, or null = inherit)
   *   - effectiveChannel (intersection of admin × user)
   */
  async listForUser(userId: string) {
    // Resolve the user's role names for eligibility checking.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        userRoles: {
          select: { role: { select: { name: true } } }
        }
      }
    });
    if (!user) throw new NotFoundException("User not found.");

    const userRoleNames = user.userRoles.map((ur) => ur.role.name);

    // Load all enabled trigger configs + the user's preferences in parallel.
    const [allTriggers, storedPrefs] = await Promise.all([
      this.prisma.notificationTriggerConfig.findMany({
        where: { isEnabled: true },
        orderBy: { label: "asc" }
      }),
      this.prisma.notificationPreference.findMany({
        where: { userId }
      })
    ]);

    const prefByTrigger = new Map(storedPrefs.map((p) => [p.trigger, p.channel as DeliveryChannel]));

    return allTriggers
      .filter((t) => isEligible(userId, userRoleNames, t))
      .map((t) => {
        const adminDeliveryMethod = t.deliveryMethod as DeliveryChannel;
        const storedChannel = prefByTrigger.get(t.trigger) ?? null;
        return {
          trigger: t.trigger,
          label: t.label,
          description: t.description,
          adminDeliveryMethod,
          storedChannel,
          effectiveChannel: resolveEffectiveChannel(adminDeliveryMethod, storedChannel)
        };
      });
  }

  /**
   * Upsert the caller's channel preference for a specific trigger.
   *
   * Validates:
   *   - `channel` must be one of: both | email | inapp | off
   *   - trigger must exist and be enabled (400 otherwise)
   *   - caller must be eligible for the trigger (403 otherwise)
   */
  async upsertForUser(userId: string, trigger: string, channel: string) {
    if (!VALID_CHANNELS.includes(channel as DeliveryChannel)) {
      throw new BadRequestException(
        `channel must be one of: ${VALID_CHANNELS.join(", ")}`
      );
    }

    const triggerConfig = await this.prisma.notificationTriggerConfig.findUnique({
      where: { trigger }
    });
    if (!triggerConfig || !triggerConfig.isEnabled) {
      throw new BadRequestException(`Trigger "${trigger}" not found or not enabled.`);
    }

    // Resolve eligibility.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        userRoles: {
          select: { role: { select: { name: true } } }
        }
      }
    });
    if (!user) throw new NotFoundException("User not found.");

    const userRoleNames = user.userRoles.map((ur) => ur.role.name);
    if (!isEligible(userId, userRoleNames, triggerConfig)) {
      throw new ForbiddenException(
        `You are not eligible for trigger "${trigger}".`
      );
    }

    const preference = await this.prisma.notificationPreference.upsert({
      where: { userId_trigger: { userId, trigger } },
      create: { userId, trigger, channel },
      update: { channel }
    });

    const adminDeliveryMethod = triggerConfig.deliveryMethod as DeliveryChannel;
    const effectiveChannel = resolveEffectiveChannel(
      adminDeliveryMethod,
      channel as DeliveryChannel
    );

    return {
      trigger: preference.trigger,
      channel: preference.channel,
      adminDeliveryMethod,
      effectiveChannel
    };
  }

  /**
   * Clear the caller's stored preference for a trigger (revert to inherit).
   * Returns 404 if no preference exists (idempotent callers: catch and ignore).
   */
  async deleteForUser(userId: string, trigger: string) {
    const existing = await this.prisma.notificationPreference.findUnique({
      where: { userId_trigger: { userId, trigger } }
    });
    if (!existing) throw new NotFoundException(`No stored preference for trigger "${trigger}".`);

    await this.prisma.notificationPreference.delete({
      where: { userId_trigger: { userId, trigger } }
    });
    return { deleted: true, trigger };
  }

  /**
   * Resolve the effective channel for a specific user + trigger from the DB.
   * Used by dispatch sites to narrow per-recipient channels.
   *
   * Returns the adminDeliveryMethod unchanged when no stored preference exists.
   * Returns "off" when the intersection is empty.
   *
   * @param userId The recipient user ID.
   * @param trigger The notification trigger key.
   * @param adminDeliveryMethod The admin-configured delivery method for the trigger.
   */
  async resolveEffectiveChannelForUser(
    userId: string,
    trigger: string,
    adminDeliveryMethod: DeliveryChannel
  ): Promise<DeliveryChannel> {
    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId_trigger: { userId, trigger } },
      select: { channel: true }
    });
    return resolveEffectiveChannel(
      adminDeliveryMethod,
      pref ? (pref.channel as DeliveryChannel) : null
    );
  }
}
