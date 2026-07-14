import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import {
  AUTH_THROTTLE_ERROR_MESSAGE,
  authThrottleLoginLimit,
  authThrottleTracker,
  authThrottleTtlMs
} from "../auth/auth-throttle.config";
import { AuthModule } from "../auth/auth.module";
import { AccessRequestsService } from "./access-requests.service";
import { AccessRequestsPublicController } from "./access-requests.controller";
import { AdminAccessRequestsController } from "./admin-access-requests.controller";

/**
 * Gated-Entra access request module.
 *
 * `AccessRequestsPublicController` exposes /auth/request-access (no JWT —
 * the Entra idToken is the credential) and reuses the auth-module
 * throttler config so it shares the same rate limit as /auth/sso.
 *
 * `AdminAccessRequestsController` exposes /admin/access-requests/* for
 * list/approve/deny (JWT + tier-gated inside the service).
 */
@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: authThrottleTtlMs, limit: authThrottleLoginLimit }],
      errorMessage: AUTH_THROTTLE_ERROR_MESSAGE,
      getTracker: (req) => authThrottleTracker(req)
    }),
    AuthModule
  ],
  controllers: [AccessRequestsPublicController, AdminAccessRequestsController],
  providers: [AccessRequestsService]
})
export class AccessRequestsModule {}
