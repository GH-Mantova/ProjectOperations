// Regression test for the §5A.3 estimator-dropdown 400: the global
// ValidationPipe runs with whitelist + forbidNonWhitelisted, so
// GET /users?role=estimator was rejected with "property role should not
// exist" because `role` was bound via @Query("role") instead of being
// declared on the query DTO. Validate here with the same pipe options.

import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ListUsersQueryDto } from "../dto/list-users-query.dto";

const PIPE_OPTIONS = { whitelist: true, forbidNonWhitelisted: true } as const;

describe("ListUsersQueryDto", () => {
  it("accepts the Team panel dropdown request (role + page + pageSize)", async () => {
    const dto = plainToInstance(ListUsersQueryDto, {
      role: "estimator",
      page: "1",
      pageSize: "100"
    });

    const errors = await validate(dto, PIPE_OPTIONS);

    expect(errors).toHaveLength(0);
    expect(dto.role).toBe("estimator");
    expect(dto.page).toBe(1);
    expect(dto.pageSize).toBe(100);
  });

  it("accepts a plain paginated request with no role", async () => {
    const dto = plainToInstance(ListUsersQueryDto, { page: "2", pageSize: "10" });

    const errors = await validate(dto, PIPE_OPTIONS);

    expect(errors).toHaveLength(0);
    expect(dto.role).toBeUndefined();
  });

  it("still rejects unknown query params", async () => {
    const dto = plainToInstance(ListUsersQueryDto, { role: "estimator", bogus: "x" });

    const errors = await validate(dto, PIPE_OPTIONS);

    expect(errors.some((e) => e.property === "bogus")).toBe(true);
  });

  it("rejects a non-string role", async () => {
    const dto = plainToInstance(ListUsersQueryDto, { role: ["a", "b"] });

    const errors = await validate(dto, PIPE_OPTIONS);

    expect(errors.some((e) => e.property === "role")).toBe(true);
  });
});
