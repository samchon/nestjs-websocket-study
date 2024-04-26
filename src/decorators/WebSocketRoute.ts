import { IWebSocketRouteReflect } from "./IWebSocketRouteReflect";

export function WebSocketRoute(
  path?: undefined | string | string[]
): MethodDecorator {
  return function WebSocketRoute(
    _target: Object,
    _propertyKey: string | symbol,
    descriptor: TypedPropertyDescriptor<any>
  ) {
    Reflect.defineMetadata(
      "nestia/WebSocketRoute",
      {
        paths: path === undefined ? [] : Array.isArray(path) ? path : [path],
      } satisfies IWebSocketRouteReflect,
      descriptor.value
    );
    return descriptor;
  };
}
export namespace WebSocketRoute {
  export function Acceptor(): ParameterDecorator {
    return function WebSocketAcceptor(
      target: Object,
      propertyKey: string | symbol | undefined,
      parameterIndex: number
    ) {
      emplace(target, propertyKey ?? "", {
        type: "acceptor",
        index: parameterIndex,
      });
    };
  }
  export function Driver(): ParameterDecorator {
    return function WebSocketDriver(
      target: Object,
      propertyKey: string | symbol | undefined,
      parameterIndex: number
    ) {
      emplace(target, propertyKey ?? "", {
        type: "driver",
        index: parameterIndex,
      });
    };
  }
  export function Header(): ParameterDecorator {
    return function WebSocketHeader(
      target: Object,
      propertyKey: string | symbol | undefined,
      parameterIndex: number
    ) {
      emplace(target, propertyKey ?? "", {
        type: "header",
        index: parameterIndex,
      });
    };
  }
  export function Param<T extends boolean | bigint | number | string | null>(
    name: string,
    assert?: (value: string) => T
  ): ParameterDecorator {
    return function WebSocketParam(
      target: Object,
      propertyKey: string | symbol | undefined,
      parameterIndex: number
    ) {
      emplace(target, propertyKey ?? "", {
        type: "param",
        index: parameterIndex,
        name,
        assert,
      });
    };
  }
  export function Query(): ParameterDecorator {
    return function WebSocketQuery(
      target: Object,
      propertyKey: string | symbol | undefined,
      parameterIndex: number
    ) {
      emplace(target, propertyKey ?? "", {
        type: "query",
        index: parameterIndex,
      });
    };
  }

  const emplace = (
    target: Object,
    propertyKey: string | symbol,
    value: IWebSocketRouteReflect.IArgument
  ) => {
    const array: IWebSocketRouteReflect.IArgument[] | undefined =
      Reflect.getMetadata(
        "nestia/WebSocketRoute/Parameter",
        target,
        propertyKey
      );
    if (array !== undefined) array.push(value);
    else
      Reflect.defineMetadata(
        "nestia/WebSocketRoute/Parameter",
        [value],
        target,
        propertyKey
      );
  };
}
