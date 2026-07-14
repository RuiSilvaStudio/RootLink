/* Ambient declarations for Vanta effect modules (no official types shipped).
   Each dist file exports a default factory function that registers a Vanta
   effect on window.VANTA and returns an instance handle with destroy/resize. */

declare module "vanta/dist/vanta.halo.min.js" {
  interface VantaInstance {
    destroy(): void;
    resize(): void;
    setOptions(opts: Record<string, unknown>): void;
  }
  const factory: (opts: Record<string, unknown>) => VantaInstance;
  export default factory;
}

declare module "vanta/dist/vanta.birds.min.js" {
  interface VantaInstance {
    destroy(): void;
    resize(): void;
    setOptions(opts: Record<string, unknown>): void;
  }
  const factory: (opts: Record<string, unknown>) => VantaInstance;
  export default factory;
}

declare module "vanta/dist/vanta.clouds.min.js" {
  interface VantaInstance {
    destroy(): void;
    resize(): void;
    setOptions(opts: Record<string, unknown>): void;
  }
  const factory: (opts: Record<string, unknown>) => VantaInstance;
  export default factory;
}

declare module "vanta/dist/vanta.topology.min.js" {
  interface VantaInstance {
    destroy(): void;
    resize(): void;
    setOptions(opts: Record<string, unknown>): void;
  }
  const factory: (opts: Record<string, unknown>) => VantaInstance;
  export default factory;
}