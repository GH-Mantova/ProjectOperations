import { HttpException, HttpStatus } from "@nestjs/common";

export class PdfRenderError extends HttpException {
  constructor(
    message: string,
    cause?: unknown,
    httpStatus: HttpStatus = HttpStatus.INTERNAL_SERVER_ERROR,
  ) {
    super(
      { statusCode: httpStatus, error: "PDF Rendering Error", message },
      httpStatus,
      cause === undefined ? undefined : { cause },
    );
    this.name = "PdfRenderError";
  }
}
