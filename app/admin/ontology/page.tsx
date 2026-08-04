import Link from "next/link";
import {
  listOntologyAdminConceptRows,
  listOntologyAdminEdgeRows,
  type OntologyConceptFilters,
  type OntologyEdgeFilters,
} from "@/db/ontology-repositories";
import { requireCatalogManager } from "@/lib/auth";
import type {
  OntologyEntityType,
  OntologyRelationType,
} from "@/lib/services/ontology-service";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const conceptStatuses = ["ACTIVE", "DRAFT", "ARCHIVED"] as const;
type OntologyStatus = (typeof conceptStatuses)[number];

const statusLabels: Record<OntologyStatus, string> = {
  ACTIVE: "Active",
  DRAFT: "Draft",
  ARCHIVED: "Archived",
};

const edgeRelations = [
  "COVERS",
  "EXPLAINS",
  "TESTS",
  "REUSES_CONTENT",
  "ASSESSED_BY",
  "PREREQUISITE_OF",
  "RELATED_TO",
  "DERIVED_FROM",
  "PARENT_OF",
  "CHILD_OF",
  "SYNONYM_OF",
  "CROSS_COURSE_EQUIVALENT",
] as const;

export default async function AdminOntologyPage({ searchParams }: PageProps) {
  await requireCatalogManager("/admin/ontology");
  const params = (await searchParams) ?? {};
  const conceptFilters = parseConceptFilters(params);
  const edgeFilters = parseEdgeFilters(params);
  const data = await loadOntologyAdminData(conceptFilters, edgeFilters);

  return (
    <>
      <header className="admin-page-header">
        <p className="eyebrow">ONTOLOGY ENGINE</p>
        <h1>Ontology Admin Console</h1>
        <p>
          Review and transition ontology concepts and edges that connect
          courses, curriculum, content, questions, and AI retrieval. Status
          changes are processed through server-side authorization and audit
          logging.
        </p>
      </header>

      {data.error ? (
        <section className="admin-panel">
          <p className="eyebrow">MIGRATION REQUIRED</p>
          <h2>Ontology storage is not available</h2>
          <p>
            The connected database does not expose the ontology tables yet, or
            they cannot be queried. Check the PostgreSQL or D1 ontology
            migration state first.
          </p>
          <p className="muted-text">Safe error code: {data.error}</p>
        </section>
      ) : (
        <>
          <section className="admin-summary-grid" aria-label="Ontology summary">
            <div className="admin-panel">
              <p className="eyebrow">CONCEPTS</p>
              <strong>{data.concepts.length.toLocaleString()}</strong>
              <span>Visible concepts</span>
            </div>
            <div className="admin-panel">
              <p className="eyebrow">EDGES</p>
              <strong>{data.edges.length.toLocaleString()}</strong>
              <span>Visible edges</span>
            </div>
            <div className="admin-panel">
              <p className="eyebrow">NAMESPACE</p>
              <strong>{conceptFilters.namespace ?? "all"}</strong>
              <span>Concept search scope</span>
            </div>
            <div className="admin-panel">
              <p className="eyebrow">COURSE</p>
              <strong>{edgeFilters.courseId ?? "global"}</strong>
              <span>Edge course scope</span>
            </div>
          </section>

          <section className="admin-panel ai-explainability-policy">
            <h2>Review policy</h2>
            <p>
              This console lets operators inspect ontology concept, alias, and
              edge status and request status transitions through the review
              workflow. Retrieval and explainability prefer ACTIVE ontology data
              and fall back to existing static aliases when needed.
            </p>
            <p className="muted-text">
              ACTIVE transitions require review evidence. ARCHIVED transitions
              require a change summary. Every transition is validated by the
              server API for role, input, same-origin request, and audit log
              recording.
            </p>
          </section>

          <OntologyFilterForm
            conceptFilters={conceptFilters}
            edgeFilters={edgeFilters}
          />

          <section className="ontology-admin-grid">
            <article className="admin-panel">
              <div className="ontology-admin-section-header">
                <div>
                  <p className="eyebrow">CONCEPTS</p>
                  <h2>Concept list</h2>
                </div>
                <Link className="button button-ghost" href="/admin/curriculum">
                  View curriculum
                </Link>
              </div>
              {data.concepts.length ? (
                <ol className="ontology-admin-list">
                  {data.concepts.map((concept) => (
                    <li key={concept.key}>
                      <div className="ontology-admin-row-title">
                        <strong>{concept.label}</strong>
                        <span
                          className={`status-pill status-${concept.status.toLowerCase()}`}
                        >
                          {concept.status}
                        </span>
                      </div>
                      <small>{concept.key}</small>
                      <dl>
                        <div>
                          <dt>ID</dt>
                          <dd>{concept.id}</dd>
                        </div>
                        <div>
                          <dt>Namespace</dt>
                          <dd>{concept.namespace}</dd>
                        </div>
                        <div>
                          <dt>Category</dt>
                          <dd>{concept.category}</dd>
                        </div>
                        <div>
                          <dt>Source</dt>
                          <dd>
                            {concept.sourceType ?? "none"} /{" "}
                            {concept.sourceId ?? "none"}
                          </dd>
                        </div>
                        <div>
                          <dt>Weight</dt>
                          <dd>{concept.weight}</dd>
                        </div>
                        <div>
                          <dt>Updated</dt>
                          <dd>{formatDateTime(concept.updatedAt)}</dd>
                        </div>
                      </dl>
                      {concept.aliases.length ? (
                        <p>Aliases: {concept.aliases.join(", ")}</p>
                      ) : null}
                      <OntologyStatusForm
                        currentStatus={concept.status}
                        targetId={concept.id}
                        targetType="CONCEPT"
                      />
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="empty-state">
                  <strong>No concepts matched the current filters.</strong>
                  <p>Adjust filters or check the ontology seed state.</p>
                </div>
              )}
            </article>

            <article className="admin-panel">
              <div className="ontology-admin-section-header">
                <div>
                  <p className="eyebrow">EDGES</p>
                  <h2>Edge list</h2>
                </div>
                <Link
                  className="button button-ghost"
                  href="/admin/ai-explainability"
                >
                  View AI trace
                </Link>
              </div>
              {data.edges.length ? (
                <ol className="ontology-admin-list">
                  {data.edges.map((edge) => (
                    <li key={edge.key}>
                      <div className="ontology-admin-row-title">
                        <strong>{edge.relation}</strong>
                        <span
                          className={`status-pill status-${edge.status.toLowerCase()}`}
                        >
                          {edge.status}
                        </span>
                      </div>
                      <small>{edge.key}</small>
                      <dl>
                        <div>
                          <dt>ID</dt>
                          <dd>{edge.id}</dd>
                        </div>
                        <div>
                          <dt>Course</dt>
                          <dd>{edge.courseId ?? "global"}</dd>
                        </div>
                        <div>
                          <dt>From</dt>
                          <dd>
                            {edge.fromType} / {edge.fromId}
                          </dd>
                        </div>
                        <div>
                          <dt>To</dt>
                          <dd>
                            {edge.toType} / {edge.toId}
                          </dd>
                        </div>
                        <div>
                          <dt>Confidence</dt>
                          <dd>{Math.round(edge.confidence * 100)}%</dd>
                        </div>
                        <div>
                          <dt>Updated</dt>
                          <dd>{formatDateTime(edge.updatedAt)}</dd>
                        </div>
                      </dl>
                      {edge.evidence.length ? (
                        <p>Evidence: {edge.evidence.join(", ")}</p>
                      ) : null}
                      <OntologyStatusForm
                        currentStatus={edge.status}
                        targetId={edge.id}
                        targetType="EDGE"
                      />
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="empty-state">
                  <strong>No edges matched the current filters.</strong>
                  <p>Adjust the course ID or relation filters.</p>
                </div>
              )}
            </article>
          </section>
        </>
      )}
    </>
  );
}

function OntologyFilterForm({
  conceptFilters,
  edgeFilters,
}: {
  conceptFilters: OntologyConceptFilters;
  edgeFilters: OntologyEdgeFilters;
}) {
  return (
    <form className="admin-panel ai-trace-filter-form" action="/admin/ontology">
      <label>
        Namespace
        <input
          name="namespace"
          defaultValue={conceptFilters.namespace ?? ""}
          placeholder="security-certification"
          maxLength={120}
        />
      </label>
      <label>
        Concept status
        <select name="conceptStatus" defaultValue={conceptFilters.status ?? ""}>
          <option value="">All</option>
          {conceptStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <label>
        Source type
        <input
          name="sourceType"
          defaultValue={conceptFilters.sourceType ?? ""}
          placeholder="CONTENT"
          maxLength={80}
        />
      </label>
      <label>
        Course ID
        <input
          name="courseId"
          defaultValue={edgeFilters.courseId ?? ""}
          placeholder="course-ise"
          maxLength={120}
        />
      </label>
      <label>
        Relation
        <select name="relation" defaultValue={edgeFilters.relation ?? ""}>
          <option value="">All</option>
          {edgeRelations.map((relation) => (
            <option key={relation} value={relation}>
              {relation}
            </option>
          ))}
        </select>
      </label>
      <label>
        Edge status
        <select name="edgeStatus" defaultValue={edgeFilters.status ?? ""}>
          <option value="">All</option>
          {conceptStatuses.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
      <div className="ai-trace-filter-actions">
        <button className="button button-dark" type="submit">
          Filter
        </button>
        <Link className="button button-ghost" href="/admin/ontology">
          Reset
        </Link>
      </div>
    </form>
  );
}

function OntologyStatusForm({
  currentStatus,
  targetId,
  targetType,
}: {
  currentStatus: OntologyStatus;
  targetId: string;
  targetType: "CONCEPT" | "EDGE";
}) {
  const options = getStatusTransitionOptions(currentStatus);

  return (
    <form
      action="/api/admin/ontology/review-status"
      className="ontology-status-form"
      method="post"
    >
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="returnTo" value="/admin/ontology" />
      <label>
        Next status
        <select name="nextStatus" defaultValue={options[0]}>
          {options.map((status) => (
            <option key={status} value={status}>
              {statusLabels[status]} ({status})
            </option>
          ))}
        </select>
      </label>
      <label>
        Review evidence
        <input
          name="evidence"
          placeholder="Official source, review ticket, or reviewer note"
          maxLength={500}
        />
      </label>
      <label>
        Change summary
        <input
          name="changeSummary"
          placeholder="Reason for archiving or status change"
          maxLength={1000}
        />
      </label>
      <button className="button button-dark" type="submit">
        Request status change
      </button>
    </form>
  );
}

async function loadOntologyAdminData(
  conceptFilters: OntologyConceptFilters,
  edgeFilters: OntologyEdgeFilters,
) {
  try {
    const [concepts, edges] = await Promise.all([
      listOntologyAdminConceptRows({ ...conceptFilters, limit: 50 }),
      listOntologyAdminEdgeRows({ ...edgeFilters, limit: 50 }),
    ]);
    return { concepts, edges, error: null };
  } catch {
    return { concepts: [], edges: [], error: "ONTOLOGY_STORAGE_UNAVAILABLE" };
  }
}

function parseConceptFilters(
  params: Record<string, string | string[] | undefined>,
): OntologyConceptFilters {
  return {
    namespace: readParam(params.namespace),
    status: parseStatus(readParam(params.conceptStatus)),
    sourceType: parseEntityType(readParam(params.sourceType)),
  };
}

function parseEdgeFilters(
  params: Record<string, string | string[] | undefined>,
): OntologyEdgeFilters {
  return {
    courseId: readParam(params.courseId),
    relation: parseRelation(readParam(params.relation)),
    status: parseStatus(readParam(params.edgeStatus)),
  };
}

function readParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const normalized = raw?.trim();
  return normalized ? normalized.slice(0, 200) : undefined;
}

function parseStatus(value: string | undefined) {
  return value === "ACTIVE" || value === "DRAFT" || value === "ARCHIVED"
    ? value
    : undefined;
}

function getStatusTransitionOptions(status: OntologyStatus): OntologyStatus[] {
  if (status === "DRAFT") return ["ACTIVE", "ARCHIVED"];
  if (status === "ACTIVE") return ["DRAFT", "ARCHIVED"];
  return ["DRAFT"];
}

function parseRelation(
  value: string | undefined,
): OntologyRelationType | undefined {
  return value && (edgeRelations as readonly string[]).includes(value)
    ? (value as OntologyRelationType)
    : undefined;
}

function parseEntityType(
  value: string | undefined,
): OntologyEntityType | undefined {
  const entityTypes: OntologyEntityType[] = [
    "CONCEPT",
    "CURRICULUM_NODE",
    "CONTENT",
    "COURSE_LESSON",
    "QUESTION",
    "STANDARD",
    "LAW",
    "CASE_STUDY",
    "WEAKNESS",
    "RISK_SCENARIO",
    "PRIVACY_ASSESSMENT_ITEM",
  ];
  return entityTypes.includes(value as OntologyEntityType)
    ? (value as OntologyEntityType)
    : undefined;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("ko-KR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Seoul",
      }).format(date);
}
