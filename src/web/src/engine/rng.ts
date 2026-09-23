export class Rng {
  private stateValue: number;

  constructor(seed = 0x9e3779b9) {
    this.stateValue = scrambleSeed(seed);
  }

  next(): number {
    let value = this.stateValue;

    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.stateValue = value >>> 0;

    return this.stateValue / 0x100000000;
  }

  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)] as T;
  }

  getState(): number {
    return this.stateValue;
  }

  setState(nextState: number) {
    this.stateValue = nextState >>> 0;
  }
}

function scrambleSeed(seed: number): number {
  let value = (seed >>> 0) + 0x9e3779b9;

  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  value = (value ^ (value >>> 16)) >>> 0;

  return value === 0 ? 0x9e3779b9 : value;
}
