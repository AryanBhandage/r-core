import { runValidationTestSuite } from "@/lib/testSuite";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const results = runValidationTestSuite();
    const allPassed = results.every((r) => r.passed);
    return Response.json({
      ok: true,
      allPassed,
      totalTests: results.length,
      passedTests: results.filter((r) => r.passed).length,
      results,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Test suite execution failed.";
    return Response.json({ ok: false, error: msg }, { status: 500 });
  }
}
