/// <reference path="../typings/get-function-location.d.ts" />

import WebSocket from "ws";
import { IncomingMessage, Server } from "http";
import { INestApplication, VersioningType } from "@nestjs/common";
import { Duplex } from "stream";
import { NestContainer } from "@nestjs/core";
import { Module } from "@nestjs/core/injector/module";
import { InstanceWrapper } from "@nestjs/core/injector/instance-wrapper";
import { IWebSocketRouteReflect } from "../decorators/IWebSocketRouteReflect";
import typia from "typia";
import { Path } from "path-parser";
import { WebAcceptor } from "tgrid";
import {
  HOST_METADATA,
  MODULE_PATH,
  PATH_METADATA,
  SCOPE_OPTIONS_METADATA,
  VERSION_METADATA,
} from "@nestjs/common/constants";
import { ArrayUtil } from "../utils/ArrayUtil";
import getFunctionLocation from "get-function-location";
import { VERSION_NEUTRAL, VersionValue } from "@nestjs/common/interfaces";

export class WebSocketAdaptor {
  public static async upgrade(
    app: INestApplication
  ): Promise<WebSocketAdaptor> {
    return new this(app, await visitApplication(app));
  }

  public readonly close = async (): Promise<void> =>
    new Promise((resolve) => {
      this.http.off("close", this.close);
      this.http.off("upgrade", this.handleUpgrade);
      this.ws.close(() => resolve());
    });

  protected constructor(app: INestApplication, operations: IOperator[]) {
    this.operators = operations;
    this.ws = new WebSocket.Server({ noServer: true });
    this.http = app.getHttpServer();
    this.http.on("close", this.close);
    this.http.on("upgrade", this.handleUpgrade);
  }

  private readonly handleUpgrade = (
    request: IncomingMessage,
    duplex: Duplex,
    head: Buffer
  ) => {
    this.ws.handleUpgrade(request, duplex, head, (client, request) =>
      WebAcceptor.upgrade(
        request,
        client as any,
        async (acceptor): Promise<void> => {
          for (const op of this.operators) {
            const params: Record<string, string> | null = op.parser.test(
              acceptor.path
            );
            if (params !== null)
              try {
                await op.handler({ params, acceptor });
              } catch (exp) {
                if (
                  acceptor.state === WebAcceptor.State.OPEN ||
                  acceptor.state === WebAcceptor.State.ACCEPTING
                )
                  await acceptor.reject(
                    1008,
                    exp instanceof Error ? exp.message : "unknown error"
                  );
              } finally {
                return;
              }
          }
          await acceptor.reject(1003, `Cannot GET ${acceptor.path}`);
        }
      )
    );
  };

  private readonly http: Server;
  private readonly operators: IOperator[];
  private readonly ws: WebSocket.Server;
}

const visitApplication = async (
  app: INestApplication
): Promise<IOperator[]> => {
  const operators: IOperator[] = [];
  const errors: IControllerError[] = [];

  const config: IConfig = {
    globalPrefix:
      typeof (app as any).config?.globalPrefix === "string"
        ? (app as any).config.globalPrefix
        : undefined,
    versioning: (() => {
      const versioning = (app as any).config?.versioningOptions;
      return versioning === undefined || versioning.type !== VersioningType.URI
        ? undefined
        : {
            prefix:
              versioning.prefix === undefined || versioning.prefix === false
                ? "v"
                : versioning.prefix,
            defaultVersion: versioning.defaultVersion,
          };
    })(),
  };
  const container: NestContainer = (app as any).container as NestContainer;
  const modules: Module[] = [...container.getModules().values()].filter(
    (m) => !!m.controllers?.size
  );
  for (const m of modules) {
    const modulePrefix: string =
      Reflect.getMetadata(
        MODULE_PATH + container.getModules().applicationId,
        m.metatype
      ) ??
      Reflect.getMetadata(MODULE_PATH, m.metatype) ??
      "";
    for (const controller of m.controllers.values())
      visitController({
        config,
        errors,
        operators,
        controller,
        modulePrefix,
      });
  }
  if (errors.length) {
    throw new Error(
      [
        `WebSocketAdaptor: ${errors.length} error(s) found:`,
        ``,
        ...errors.map((e) =>
          [
            `  - controller: ${e.name}`,
            `  - methods:`,
            ...e.methods.map((m) =>
              [
                `  - name: ${m.name}`,
                `  - file: ${m.source}:${m.line}:${m.column}`,
                `  - reasons:`,
                ...m.messages.map(
                  (msg) =>
                    `  - ${msg
                      .split("\n")
                      .map((str) => `  ${str}`)
                      .join("\n")}`
                ),
              ]
                .map((str) => `  ${str}`)
                .join("\n")
            ),
          ]
            .map((str) => `  ${str}`)
            .join("\n")
        ),
      ].join("\n")
    );
  }
  return operators;
};

const visitController = async (props: {
  config: IConfig;
  errors: IControllerError[];
  operators: IOperator[];
  controller: InstanceWrapper<object>;
  modulePrefix: string;
}): Promise<void> => {
  if (
    ArrayUtil.has(
      Reflect.getMetadataKeys(props.controller.metatype),
      PATH_METADATA,
      HOST_METADATA,
      SCOPE_OPTIONS_METADATA
    ) === false
  )
    return;

  const methodErrors: IMethodError[] = [];
  const controller: IController = {
    name: props.controller.name,
    instance: props.controller.instance,
    constructor: props.controller.metatype,
    prototype: Object.getPrototypeOf(props.controller.instance),
    prefixes: (() => {
      const value: string | string[] = Reflect.getMetadata(
        PATH_METADATA,
        props.controller.metatype
      );
      if (typeof value === "string") return [value];
      else if (value.length === 0) return [""];
      else return value;
    })(),
    versions: getVersions(
      Reflect.getMetadata(VERSION_METADATA, props.controller.metatype)
    ),
    modulePrefix: props.modulePrefix,
  };
  for (const mk of Object.getOwnPropertyNames(controller.prototype).filter(
    (key) =>
      key !== "constructor" && typeof controller.prototype[key] === "function"
  )) {
    const errorMessages: string[] = [];
    visitMethod({
      config: props.config,
      operators: props.operators,
      controller,
      method: {
        key: mk,
        value: controller.prototype[mk],
      },
      report: (msg) => errorMessages.push(msg),
    });
    if (errorMessages.length)
      methodErrors.push({
        name: mk,
        messages: errorMessages,
        ...(await getFunctionLocation(controller.prototype[mk])),
      });
  }

  if (methodErrors.length)
    props.errors.push({
      name: controller.name,
      methods: methodErrors,
    });
};

const visitMethod = (props: {
  config: IConfig;
  operators: IOperator[];
  controller: IController;
  method: Entry<Function>;
  report: (message: string) => void;
}): void => {
  const route: IWebSocketRouteReflect | undefined = Reflect.getMetadata(
    "nestia/WebSocketRoute",
    props.method.value
  );
  if (typia.is<IWebSocketRouteReflect>(route) === false) return;

  const parameters: IWebSocketRouteReflect.IArgument[] = (
    (Reflect.getMetadataKeys(props.controller.prototype, props.method.key)
      .map((key) => ({
        key,
        value: Reflect.getMetadata(
          key,
          props.controller.prototype,
          props.method.key
        ),
      }))
      .find((r) => r.key === "nestia/WebSocketRoute/Parameter")?.value ??
      []) as IWebSocketRouteReflect.IArgument[]
  ).sort((a, b) => a.index - b.index);
  // acceptor must be
  if (parameters.some((p) => p.type === "acceptor") === false)
    return props.report(
      "@WebSocketRoute.Acceptor() decorated parameter must be."
    );
  // length of parameters must be fulfilled
  if (parameters.length !== props.method.value.length)
    return props.report(
      [
        "length of parameters must be fulfilled. Fill every parameters with one of below:",
        "  - @WebSocketRoute.Acceptor()",
        "  - @WebSocketRoute.Driver()",
        "  - @WebSocketRoute.Header()",
        "  - @WebSocketRoute.Param()",
        "  - @WebSocketRoute.Query()",
      ].join("\n")
    );
  const versions: string[] = (() => {
    if (props.config.versioning === undefined) return [""];
    const set = new Set([
      ...props.controller.versions,
      ...getVersions(Reflect.getMetadata(VERSION_METADATA, props.method.value)),
    ]);
    const array =
      set.size === 0
        ? getVersions(props.config.versioning.defaultVersion)
        : Array.from(set);
    return array.map((v) =>
      typeof v === "symbol" ? "" : `${props.config.versioning!.prefix}${v}`
    );
  })();
  for (const v of versions)
    for (const cp of props.controller.prefixes)
      for (const mp of route.paths) {
        const parser: Path = new Path(
          "/" +
            [
              props.config.globalPrefix ?? "",
              v,
              props.controller.modulePrefix,
              cp,
              mp,
            ]
              .filter((str) => !!str.length)
              .join("/")
              .split("/")
              .filter((str) => str.length)
              .join("/")
        );
        const pathParams: IWebSocketRouteReflect.IParam[] = parameters.filter(
          (p) => p.type === "param"
        ) as IWebSocketRouteReflect.IParam[];
        if (parser.params.length !== pathParams.length) {
          props.report(
            [
              `Path "${parser}" must have same number of parameters with @WebSocketRoute.Param()`,
              `  - path: ${JSON.stringify(parser.params)}`,
              `  - arguments: ${JSON.stringify(pathParams.map((p) => p.name))}`,
            ].join("\n")
          );
          continue;
        }
        const meet: boolean = pathParams
          .map((p) => {
            const has: boolean = parser.params.includes(p.name);
            if (has === false)
              props.report(
                `Path "${parser}" must have parameter "${p.name}" with @WebSocketRoute.Param()`
              );
            return has;
          })
          .every((b) => b);
        if (meet === false) continue;

        props.operators.push({
          parser,
          handler: async (input: {
            params: Record<string, string>;
            acceptor: WebAcceptor<any, any>;
          }): Promise<void> => {
            const args: any[] = [];
            for (const p of parameters) {
              if (p.type === "acceptor") args.push(input.acceptor);
              else if (p.type === "driver")
                args.push(input.acceptor.getDriver());
              else if (p.type === "header") args.push(input.acceptor.header);
              else if (p.type === "param") args.push(input.params[p.name]);
            }
            await props.method.value.call(props.controller.instance, ...args);
          },
        });
      }
};

const getVersions = (
  value: VersionValue | undefined
): Array<string | typeof VERSION_NEUTRAL> =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

interface Entry<T> {
  key: string;
  value: T;
}

interface IController {
  name: string;
  versions: Array<string | typeof VERSION_NEUTRAL>;
  instance: object;
  constructor: Function;
  prototype: any;
  prefixes: string[];
  modulePrefix: string;
}
interface IOperator {
  parser: Path;
  handler: (props: {
    params: Record<string, string>;
    acceptor: WebAcceptor<any, any>;
  }) => Promise<any>;
}
interface IConfig {
  globalPrefix?: string;
  versioning?: {
    prefix: string;
    defaultVersion?: VersionValue;
  };
}

interface IControllerError {
  name: string;
  methods: IMethodError[];
}
interface IMethodError {
  name: string;
  messages: string[];
  source: string;
  line: number;
  column: number;
}
