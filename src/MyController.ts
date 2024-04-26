import { Controller, Get, Version } from "@nestjs/common";
import { WebSocketRoute } from "./decorators/WebSocketRoute";
import { WebAcceptor } from "tgrid";
import { ICalculator } from "./providers/ICalculator";
import { Calculator } from "./providers/Calculator";

@Controller(["my", "yours"])
export class MyController {
  @Get(["ping", "check", "pong"])
  public get() {}

  @Version(["1"])
  @WebSocketRoute(["calculator", "computer"])
  public async calculator(
    @WebSocketRoute.Acceptor() acceptor: WebAcceptor<null, ICalculator>
  ): Promise<void> {
    await acceptor.accept(new Calculator());
  }

  @Version("2")
  @WebSocketRoute("calc/:x/:y")
  public async calc(
    @WebSocketRoute.Param("x") x: string,
    @WebSocketRoute.Param("y") y: string,
    @WebSocketRoute.Acceptor() acceptor: WebAcceptor<null, ICalculator>
  ): Promise<void> {
    await acceptor.accept(new Calculator());
  }
}
