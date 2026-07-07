import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags
} from "@nestjs/swagger";
import { CurrentUser } from "../../common/auth/current-user.decorator";
import { JwtAuthGuard } from "../../common/auth/jwt-auth.guard";
import { PermissionsGuard } from "../../common/auth/permissions.guard";
import { RequirePermissions } from "../../common/auth/permissions.decorator";
import { InternalMessagesService } from "./internal-messages.service";
import { ListInternalMessagesQueryDto } from "./dto/list-internal-messages.query.dto";
import { SendInternalMessageDto } from "./dto/send-internal-message.dto";

@ApiTags("Internal Messages")
@ApiBearerAuth()
@Controller("internal-messages")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InternalMessagesController {
  constructor(private readonly messages: InternalMessagesService) {}

  @Get()
  @RequirePermissions("internal-messages.view")
  @ApiOperation({
    summary:
      "List internal messages. With entityType+entityId returns the record thread involving the caller; without, returns the caller's inbox (unread-first)."
  })
  @ApiQuery({ name: "entityType", required: false, type: String })
  @ApiQuery({ name: "entityId", required: false, type: String })
  @ApiResponse({ status: 200, description: "Messages visible to the caller." })
  list(
    @Query() query: ListInternalMessagesQueryDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.messages.listForCaller(actor.sub, {
      entityType: query.entityType,
      entityId: query.entityId
    });
  }

  @Post()
  @RequirePermissions("internal-messages.send")
  @ApiOperation({ summary: "Send a record-anchored internal message" })
  @ApiResponse({ status: 201, description: "Message sent; a notification is fanned out to the recipient." })
  send(
    @Body() dto: SendInternalMessageDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.messages.send(dto, actor.sub);
  }

  @Patch(":id/read")
  @RequirePermissions("internal-messages.view")
  @ApiOperation({ summary: "Mark an internal message as read (recipient only)" })
  @ApiResponse({ status: 200, description: "Message marked read." })
  markRead(@Param("id") id: string, @CurrentUser() actor: { sub: string }) {
    return this.messages.markRead(id, actor.sub);
  }
}
