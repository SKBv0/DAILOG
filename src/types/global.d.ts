/// <reference types="vite/client" />

import type { ReactFlowInstance } from "reactflow";
import type { EdgePathCache } from "../utils/edgePathCache";
import type { EdgePreloader } from "../utils/edgePreloader";

declare global {
  interface Window {
    reactFlowInstance?: ReactFlowInstance;
    __edgePathCache?: EdgePathCache;
    __edgePreloader?: EdgePreloader;
  }
}

declare module "*.json" {
  const value: any;
  export default value;
}
