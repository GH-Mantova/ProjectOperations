import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { AppModule } from "../app.module";
import { ApiExceptionFilter } from "../common/filters/api-exception.filter";

export async function createApp() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const apiPrefix = configService.get<string>("app.apiPrefix", "api/v1");
  const corsOrigin = configService.get<string>("app.corsOrigin", "http://localhost:5173");

  app.use(helmet());
  app.enableCors({ origin: corsOrigin, credentials: true });
  app.setGlobalPrefix(apiPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true
    })
  );
  app.useGlobalFilters(new ApiExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Project Operations Platform API")
    .setDescription("Foundation API for the Project Operations Platform.")
    .setVersion("0.1.0")
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, swaggerDocument);

  const webDistPath = resolveWebDistPath();

  if (webDistPath) {
    app.useStaticAssets(webDistPath);

    const httpAdapter = app.getHttpAdapter().getInstance();
    httpAdapter.get(/^\/(?!api(?:\/|$)).*/, (_request: unknown, response: { sendFile: (path: string) => void }) => {
      response.sendFile(join(webDistPath, "index.html"));
    });
  }

  return app;
}

function resolveWebDistPath() {
  const candidates = [
    resolve(process.cwd(), "apps", "web", "dist"),
    resolve(process.cwd(), "..", "web", "dist"),
    resolve(__dirname, "..", "..", "..", "web", "dist")
  ];

  return candidates.find((candidate) => existsSync(candidate));
}
