import { publicCopy } from "@/lib/public-copy";

type FlowNode = {
  id: string;
  nodeType: string;
  title: string;
  description: string;
  systemName: string;
  organizationName: string;
  displayX: number;
  displayY: number;
};

type FlowEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  dataTypes: string;
  transferMethod: string;
  purpose: string;
  protectionMeasures: string;
};

function isExternalTransfer(method: string) {
  return method.includes("외부") || method.toLowerCase().includes("external");
}

export function PrivacyFlowDiagram({
  nodes,
  edges,
}: {
  nodes: FlowNode[];
  edges: FlowEdge[];
}) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));

  return (
    <section className="privacy-flow" aria-labelledby="privacy-flow-title">
      <h2 id="privacy-flow-title">개인정보 처리 흐름</h2>
      {nodes.length ? (
        <>
          <div className="privacy-flow-canvas">
            <svg
              viewBox="0 0 1000 560"
              role="img"
              aria-labelledby="privacy-flow-svg-title privacy-flow-svg-desc"
            >
              <title id="privacy-flow-svg-title">등록된 개인정보 처리 흐름도</title>
              <desc id="privacy-flow-svg-desc">
                화살표와 선 종류로 수집, 처리, 저장, 제공 관계를 표시합니다. 아래에
                동일한 텍스트 목록이 있습니다.
              </desc>
              <defs>
                <marker
                  id="flow-arrow"
                  markerWidth="10"
                  markerHeight="10"
                  refX="8"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L0,6 L9,3 z" />
                </marker>
              </defs>
              {edges.map((edge) => {
                const source = nodeMap.get(edge.sourceNodeId);
                const target = nodeMap.get(edge.targetNodeId);
                if (!source || !target) return null;
                return (
                  <g key={edge.id}>
                    <line
                      x1={source.displayX + 75}
                      y1={source.displayY + 32}
                      x2={target.displayX + 75}
                      y2={target.displayY + 32}
                      className={
                        isExternalTransfer(edge.transferMethod)
                          ? "flow-edge external"
                          : "flow-edge"
                      }
                      markerEnd="url(#flow-arrow)"
                    />
                    <text
                      x={(source.displayX + target.displayX) / 2 + 75}
                      y={(source.displayY + target.displayY) / 2 + 20}
                    >
                      {publicCopy(edge.dataTypes)}
                    </text>
                  </g>
                );
              })}
              {nodes.map((node) => {
                const title = publicCopy(node.title);
                const description = publicCopy(node.description);
                return (
                  <g
                    className={`flow-node node-${node.nodeType.toLowerCase()}`}
                    transform={`translate(${node.displayX} ${node.displayY})`}
                    tabIndex={0}
                    role="group"
                    aria-label={`${node.nodeType}, ${title}, ${description}`}
                    key={node.id}
                  >
                    <rect width="150" height="64" rx="10" />
                    <text x="75" y="25" textAnchor="middle">
                      {title}
                    </text>
                    <text className="flow-node-type" x="75" y="46" textAnchor="middle">
                      {node.nodeType}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          <ol className="privacy-flow-alternative" aria-label="개인정보 흐름 텍스트 대체 목록">
            {nodes.map((node) => (
              <li key={node.id}>
                <strong>{publicCopy(node.title)}</strong>
                <span>
                  {node.nodeType} · {publicCopy(node.systemName || node.organizationName)}
                </span>
                <p>{publicCopy(node.description)}</p>
                <ul>
                  {edges
                    .filter((edge) => edge.sourceNodeId === node.id)
                    .map((edge) => {
                      const target = nodeMap.get(edge.targetNodeId);
                      return (
                        <li key={edge.id}>
                          → {publicCopy(target?.title)}: {publicCopy(edge.dataTypes)},{" "}
                          {publicCopy(edge.transferMethod)}
                          {edge.protectionMeasures
                            ? `, 보호조치 ${publicCopy(edge.protectionMeasures)}`
                            : ""}
                        </li>
                      );
                    })}
                </ul>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="empty-state">등록된 흐름 노드가 없습니다.</p>
      )}
    </section>
  );
}
