import { ComponentType, memo } from "react";
import { NodeProps } from "reactflow";
import { DialogNodeData } from "../../types/dialog";
import "./NodeWrapper.css";

export interface GenerateDialogOptions {
  customPrompt?: string;
  systemPrompt?: string;
  ignoreConnections?: boolean;
}

export type ExtendedNodeData = Omit<DialogNodeData, "onGenerateDialog"> & {
  onGenerateDialog?: (
    _nodeId: string,
    _mode: "recreate" | "improve" | "custom" | "regenerateFromHere",
    _options?: GenerateDialogOptions
  ) => void;
};

export function createNodeWrapper(BaseComponent: ComponentType<any>) {
  return memo((props: NodeProps<any>) => {
    const hasIssue = !!props.data?.hasIssue;
    const wrapperClassName = hasIssue ? "node-wrapper node-has-issue" : "node-wrapper";

    return (
      <div className={wrapperClassName}>
        <BaseComponent {...props} />
      </div>
    );
  });
}
