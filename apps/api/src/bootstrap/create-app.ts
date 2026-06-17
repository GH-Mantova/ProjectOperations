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

  const isProduction = (process.env.NODE_ENV ?? "development") === "production";

  if (isProduction) {
    const webDistPath = resolveWebDistPath();

    if (webDistPath) {
      app.useStaticAssets(webDistPath);

      const httpAdapter = app.getHttpAdapter().getInstance();
      httpAdapter.get(/^\/(?!api(?:\/|$)).*/, (_request: unknown, response: { sendFile: (path: string) => void }) => {
        response.sendFile(join(webDistPath, "index.html"));
      });
    }
  } else {
    const helper = renderDevHelper(corsOrigin, "/api/docs");

    const httpAdapter = app.getHttpAdapter().getInstance();
    httpAdapter.get(
      /^\/(?!api(?:\/|$)).*/,
      (_request: unknown, response: { status: (code: number) => { type: (t: string) => { send: (b: string) => void } } }) => {
        response.status(200).type("text/html").send(helper);
      }
    );
  }

  return app;
}

export function renderDevHelper(viteUrl: string, swaggerUrl: string) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Project Operations API (dev)</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 640px; margin: 4rem auto; padding: 0 1rem; color: #1f2937; }
  h1 { margin-bottom: 0.25rem; }
  p { line-height: 1.5; }
  code { background: #f3f4f6; padding: 0.1rem 0.35rem; border-radius: 4px; }
  .links a { display: inline-block; margin-right: 1rem; }
</style>
</head>
<body>
<h1>API dev server</h1>
<p>You are hitting the NestJS API on <code>:3000</code>. The frontend is served separately by Vite.</p>
<p class="links">
  <a href="${viteUrl}">Open frontend (Vite) →</a>
  <a href="${swaggerUrl}">Open API docs →</a>
</p>
<p>In development, the API does not serve <code>apps/web/dist</code>, so you will never see a stale built frontend here.</p>
</body>
</html>`;
}

function resolveWebDistPath() {
  const candidates = [
    resolve(process.cwd(), "apps", "web", "dist"),
    resolve(process.cwd(), "..", "web", "dist"),
    resolve(__dirname, "..", "..", "..", "web", "dist")
  ];

  return candidates.find((candidate) => existsSync(candidate));
}
