import { getDatabaseProvider } from "@/db";
import { requireApiUser } from "@/lib/auth";
import { assertRateLimit } from "@/lib/rate-limit";
import {
  assertIseWaveAGovernanceActor,
  executeIseWaveAOwnerAttestation,
  executeIseWaveAReviewDomain,
  readIseWaveAGovernanceReadiness,
} from "@/lib/services/ise-wave-a-governance-runtime";
import { handleIseWaveAGovernanceRequest } from "@/lib/services/ise-wave-a-governance-route";

export async function GET(request: Request) {
  return handleIseWaveAGovernanceRequest("GET", request, dependencies());
}

export async function POST(request: Request) {
  return handleIseWaveAGovernanceRequest("POST", request, dependencies());
}

function dependencies() {
  return {
    requireUser: requireApiUser,
    getDatabase: getDatabaseProvider,
    assertActor: assertIseWaveAGovernanceActor,
    rateLimit: assertRateLimit,
    readReadiness: readIseWaveAGovernanceReadiness,
    ownerAttest: executeIseWaveAOwnerAttestation,
    reviewDomain: executeIseWaveAReviewDomain,
  };
}
