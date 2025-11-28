import { EdgeTypes } from "reactflow";
import DraggableEdge from "./DraggableEdge";
import BundledEdge from "../edges/BundledEdge";

export const edgeTypes: EdgeTypes = {
  default: DraggableEdge,
  bundled: BundledEdge,
  custom: BundledEdge,
};

export default edgeTypes;
