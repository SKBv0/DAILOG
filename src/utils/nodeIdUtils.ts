const NODE_ID_PREFIX = "node";
const CONN_ID_PREFIX = "conn";
const NODE_ID_MAPPING_KEY = "dialog-flow-node-id-mapping";

interface NodeIdInfo {
  created: number;
  lastUsed: number;
}

interface StringIndexMap<T> {
  [key: string]: T;
}

export const generatePersistentNodeId = (nodeType: string): string => {
  const baseId = generateUniqueId();
  const nodeId = `${NODE_ID_PREFIX}-${nodeType}-${baseId}`;
  storeNodeId(nodeId);

  return nodeId;
};

export const generateConnectionId = (
  sourceId: string,
  targetId: string,
): string => {
  const timestamp = Date.now();
  return `${CONN_ID_PREFIX}-${timestamp}-${sourceId.slice(0, 8)}-${targetId.slice(0, 8)}`;
};

const generateUniqueId = (): string => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${randomPart}`;
};

const storeNodeId = (nodeId: string): void => {
  try {
    const storedMapping = safeStorage.get(NODE_ID_MAPPING_KEY);
    let idMapping: StringIndexMap<NodeIdInfo> = {};

    if (storedMapping) {
      idMapping = JSON.parse(storedMapping);
    }

    if (!idMapping[nodeId]) {
      idMapping[nodeId] = {
        created: Date.now(),
        lastUsed: Date.now(),
      };
      safeStorage.set(NODE_ID_MAPPING_KEY, JSON.stringify(idMapping));
    } else {
      idMapping[nodeId].lastUsed = Date.now();
      safeStorage.set(NODE_ID_MAPPING_KEY, JSON.stringify(idMapping));
    }
  } catch (error) {
  }
};

export const isValidNodeId = (nodeId: string): boolean => {
  return nodeId.startsWith(NODE_ID_PREFIX);
};

export const getNodeTypeFromId = (nodeId: string): string | null => {
  if (!isValidNodeId(nodeId)) return null;

  const parts = nodeId.split("-");
  if (parts.length < 3) return null;

  return parts[1];
};

export const convertToStableId = (oldId: string, nodeType: string): string => {
  if (oldId.includes(nodeType)) {
    return oldId;
  }

  const newId = generatePersistentNodeId(nodeType);

  try {
    const mappingKey = "dialog-flow-id-conversion-map";
    const storedMapping = safeStorage.get(mappingKey);
    let conversionMap: StringIndexMap<string> = {};

    if (storedMapping) {
      conversionMap = JSON.parse(storedMapping);
    }

    conversionMap[oldId] = newId;
    safeStorage.set(mappingKey, JSON.stringify(conversionMap));
  } catch (error) {
  }

  return newId;
};

export const getNodeBaseId = (id: string): string => {
  const parts = id.split("-");
  if (parts.length < 2) return id;

  return `${parts[0]}-${parts[1]}`;
};
import { safeStorage } from "./safeStorage";
