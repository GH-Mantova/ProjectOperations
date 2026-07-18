import {
  Body,
  Controller,
  Delete,
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
import { ExpensesService } from "./expenses.service";
import {
  CreateExpenseDto,
  ExpenseStatusDto,
  ListExpensesQueryDto,
  RejectExpenseDto,
  UpdateExpenseDto
} from "./dto/expense.dto";

/**
 * REST endpoints for expense capture + approval (D365-parity slice 1).
 *
 * Read paths require `expenses.view`.
 * Draft / submit paths require `expenses.manage`.
 * Approve / reject / reimburse paths require `expenses.approve`.
 *
 * Approval routing defers to AuthorityService.check("expenses.approve") —
 * spend ceilings are Director-configurable, not hardcoded here.
 */
@ApiTags("Expenses")
@ApiBearerAuth()
@Controller("expenses")
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ExpensesController {
  constructor(private readonly service: ExpensesService) {}

  @Get()
  @RequirePermissions("expenses.view")
  @ApiOperation({ summary: "List expense submissions" })
  @ApiQuery({ name: "status", required: false, enum: ExpenseStatusDto })
  @ApiQuery({ name: "submittedById", required: false })
  @ApiQuery({ name: "projectId", required: false })
  @ApiQuery({ name: "jobId", required: false })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "pageSize", required: false, type: Number })
  @ApiResponse({ status: 200, description: "Paginated expense list." })
  listExpenses(@Query() query: ListExpensesQueryDto) {
    return this.service.listExpenses(query);
  }

  @Get(":id")
  @RequirePermissions("expenses.view")
  @ApiOperation({ summary: "Get an expense by ID" })
  @ApiResponse({ status: 200, description: "Expense detail." })
  @ApiResponse({ status: 404, description: "Expense not found." })
  getExpense(@Param("id") id: string) {
    return this.service.getExpense(id);
  }

  @Post()
  @RequirePermissions("expenses.manage")
  @ApiOperation({ summary: "Create a new DRAFT expense claim" })
  @ApiResponse({ status: 201, description: "Expense created with auto-assigned EXP-YYYY-NNN number." })
  createExpense(
    @Body() dto: CreateExpenseDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.createExpense(dto, actor.sub);
  }

  @Patch(":id")
  @RequirePermissions("expenses.manage")
  @ApiOperation({ summary: "Update a DRAFT or REJECTED expense claim" })
  @ApiResponse({ status: 200, description: "Expense updated." })
  @ApiResponse({ status: 400, description: "Expense is not editable in its current status." })
  updateExpense(
    @Param("id") id: string,
    @Body() dto: UpdateExpenseDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.updateExpense(id, dto, actor.sub);
  }

  @Post(":id/submit")
  @RequirePermissions("expenses.manage")
  @ApiOperation({ summary: "Submit a DRAFT or REJECTED expense for approval" })
  @ApiResponse({ status: 201, description: "Expense submitted for approval." })
  @ApiResponse({ status: 400, description: "Expense is not in a submittable status." })
  submitExpense(
    @Param("id") id: string,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.submitExpense(id, actor.sub);
  }

  @Post(":id/approve")
  @RequirePermissions("expenses.approve")
  @ApiOperation({ summary: "Approve a SUBMITTED expense claim" })
  @ApiResponse({ status: 201, description: "Expense approved." })
  @ApiResponse({ status: 400, description: "Expense is not SUBMITTED." })
  @ApiResponse({ status: 403, description: "Amount exceeds approval authority." })
  approveExpense(
    @Param("id") id: string,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.approveExpense(id, actor.sub);
  }

  @Post(":id/reject")
  @RequirePermissions("expenses.approve")
  @ApiOperation({ summary: "Reject a SUBMITTED expense claim" })
  @ApiResponse({ status: 201, description: "Expense rejected." })
  @ApiResponse({ status: 400, description: "Expense is not SUBMITTED." })
  rejectExpense(
    @Param("id") id: string,
    @Body() dto: RejectExpenseDto,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.rejectExpense(id, dto, actor.sub);
  }

  @Post(":id/reimburse")
  @RequirePermissions("expenses.approve")
  @ApiOperation({ summary: "Mark an APPROVED expense as REIMBURSED" })
  @ApiResponse({ status: 201, description: "Expense marked as REIMBURSED." })
  @ApiResponse({ status: 400, description: "Expense is not APPROVED." })
  reimburseExpense(
    @Param("id") id: string,
    @CurrentUser() actor: { sub: string }
  ) {
    return this.service.reimburseExpense(id, actor.sub);
  }
}
