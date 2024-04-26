import { NestFactory } from "@nestjs/core";
import { Driver, WebConnector } from "tgrid";
import { MyModule } from "./MyModule";
import { WebSocketAdaptor } from "./adaptors/WebSocketAdaptor";
import { ICalculator } from "./providers/ICalculator";
import { VersioningType } from "@nestjs/common";

const main = async (): Promise<void> => {
  const app = await NestFactory.create(MyModule, { logger: false });
  app.setGlobalPrefix("api");
  app.enableVersioning({
    type: VersioningType.URI,
    prefix: "v",
  });
  await app.listen(3000);
  await WebSocketAdaptor.upgrade(app);

  const validate = async (path: string): Promise<void> => {
    const connector: WebConnector<null, null> = new WebConnector(null, null);
    await connector.connect(`ws://localhost:3000${path}`);
    const calculator: Driver<ICalculator> = connector.getDriver<ICalculator>();
    console.log(await calculator.plus(1, 2));
    await connector.close();
  };
  await validate("/api/v1/my/calculator");
  await validate("/api/v1/yours/computer");
  await validate("/api/v2/my/calc/1/2");
  await app.close();
};
main().catch((exp) => {
  console.log(exp);
  process.exit(-1);
});
