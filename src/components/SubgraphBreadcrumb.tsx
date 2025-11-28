import React from "react";
import useSubgraphNavigationStore from "../store/subgraphNavigationStore";

const SubgraphBreadcrumb: React.FC = () => {
  const { getBreadcrumbs, exitToMain, exitSubgraph, isInSubgraph } = useSubgraphNavigationStore();
  
  const breadcrumbs = getBreadcrumbs();
  
  if (!isInSubgraph()) {
    return null;
  }

  const handleBreadcrumbClick = (index: number) => {
    if (index === 0) {
      exitToMain();
    } else {
      const targetDepth = index - 1;
      const currentDepth = breadcrumbs.length - 2;
      
      for (let i = currentDepth; i > targetDepth; i--) {
        exitSubgraph();
      }
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-gray-900/90 border-b border-gray-700 relative z-50">
      <span className="text-xs text-gray-400">Navigation:</span>
      <div className="flex items-center gap-1">
        {breadcrumbs.map((crumb, index) => (
          <React.Fragment key={crumb.id}>
            <button
              onClick={() => handleBreadcrumbClick(index)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                index === breadcrumbs.length - 1
                  ? "text-white bg-blue-600/20 border border-blue-600/30"
                  : "text-gray-300 hover:text-white hover:bg-gray-700/50"
              }`}
            >
              {crumb.name}
            </button>
            {index < breadcrumbs.length - 1 && (
              <span className="text-gray-600 text-xs">→</span>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default SubgraphBreadcrumb;
