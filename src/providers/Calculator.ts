import { ICalculator } from "./ICalculator";

export class Calculator implements ICalculator {
  plus(a: number, b: number): number {
    return a + b;
  }
  minus(a: number, b: number): number {
    return a - b;
  }
  multiply(a: number, b: number): number {
    return a * b;
  }
  divide(a: number, b: number): number {
    return a / b;
  }
}
