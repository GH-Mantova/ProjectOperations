import { ConfigService } from "@nestjs/config";
import { createApp } from "./bootstrap/create-app";

async function bootstrap() {
  const app = await createApp();
  const configService = app.get(ConfigService);
  const port = configService.get<number>("app.port", 3000);

  await app.listen(port);
}

bootstrap();
