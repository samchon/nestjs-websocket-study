import { Module } from "@nestjs/common";
import { MyController } from "./MyController";

@Module({
  controllers: [MyController],
})
export class MyModule {}
