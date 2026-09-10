import { loadGeneratorInputAuthority, validateGeneratorInputAuthority } from "./security-content-v3-generator-input.mjs";

try {
  const authority = await loadGeneratorInputAuthority();
  const result = await validateGeneratorInputAuthority(authority);
  if (!result.ok) throw new Error("SECURITY_CONTENT_V3_GENERATOR_INPUT_INVALID");
  console.log(JSON.stringify({
    status: "SECURITY_CONTENT_V3_GENERATOR_INPUT_VALID",
    inputAuthorityId: authority.manifest.identity.inputAuthorityId,
    fixtureId: authority.manifest.identity.fixtureId,
    fixtureByteSha256: result.fixtureByteSha256,
    fixtureSemanticSha256: result.fixtureSemanticSha256,
    sourceBindings: authority.manifest.sourceHashes.length,
    generatorBindings: authority.manifest.generatorHashes.length,
    outputOwnership: authority.manifest.outputOwnership.length,
    questionRows: authority.projection.questionRows.length,
    personalData: authority.manifest.privacy.personalData,
    learnerEvidence: authority.manifest.privacy.learnerEvidence,
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    status: "SECURITY_CONTENT_V3_GENERATOR_INPUT_INVALID",
    error: error instanceof Error ? error.message : String(error),
    failures: error?.failures ?? [],
  }, null, 2));
  process.exitCode = 1;
}
