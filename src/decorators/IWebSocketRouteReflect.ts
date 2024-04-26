export interface IWebSocketRouteReflect {
  paths: string[];
}
export namespace IWebSocketRouteReflect {
  export type IArgument = IAcceptor | IDriver | IHeader | IParam | IQuery;
  export interface IAcceptor extends IBase<"acceptor"> {}
  export interface IDriver extends IBase<"driver"> {}
  export interface IHeader extends IBase<"header"> {}
  export interface IParam extends IBase<"param"> {
    name: string;
    assert?: (value: string) => any;
  }
  export interface IQuery extends IBase<"query"> {}

  interface IBase<Type extends string> {
    type: Type;
    index: number;
  }
}
