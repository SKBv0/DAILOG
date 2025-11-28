import React from "react";
import { Toolbar, ToolbarProps } from "../Toolbar";

type ToolbarSectionProps = ToolbarProps;

const ToolbarSection: React.FC<ToolbarSectionProps> = React.memo((props) => {
  return (
    <div className="h-10 flex-shrink-0">
      <Toolbar {...props} />
    </div>
  );
});

ToolbarSection.displayName = "ToolbarSection";

export default ToolbarSection;
