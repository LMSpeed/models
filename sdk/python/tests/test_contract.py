"""user can consume the shared catalogue offline in Python."""
import json
from pathlib import Path
import unittest
from lmspeed_models import Catalog
ROOT = Path(__file__).resolve().parent / "data"
class UserContractTests(unittest.TestCase):
    def test_user_resolves_shared_contract_cases_and_preserves_null_values(self):
        # Given the shared catalogue and explicit identity examples.
        catalog = Catalog.from_json((ROOT / "valid.json").read_text())
        cases = json.loads((ROOT / "resolution.json").read_text())
        # When each example is resolved offline through the installed package.
        for case in cases:
            result = catalog.resolve_model_id(case["input"], case.get("namespace"))
            # Then no source identity, null, false or zero is guessed away.
            self.assertEqual(result.status, case["status"])
            if "canonicalId" in case:
                self.assertEqual(result.canonical_id, case["canonicalId"])
            if "candidates" in case:
                self.assertEqual(result.candidates, case["candidates"])
        model = catalog.get("Example LLM")
        self.assertEqual(model.specs.text.context_window_tokens, 0)
        self.assertIs(model.capabilities.reasoning, False)
        self.assertIsNone(model.specs.text.max_output_tokens)
        self.assertEqual(model.knowledge_cutoff, "2026-01")
        self.assertEqual([m.id for m in catalog.filter(task="image-generation")], ["fixture-image"])
        self.assertEqual(catalog.icon_url("Example LLM"), "https://models.lmspeed.net/v1/models/fixture-llm.svg")
if __name__ == "__main__":
    unittest.main()

class UserHttpTests(unittest.TestCase):
    def test_user_revalidates_and_retains_cached_data_after_boundary_failure(self):
        import os
        from lmspeed_models import Client, ModelsError
        base = os.environ.get("MODEL_TEST_BASE_URL")
        if not base:
            self.skipTest("HTTP contract service is configured by test-sdks")
        # Given the verified static success contract on a real HTTP service.
        client = Client(base + "/valid")
        # When explicit refresh is followed by HTTP revalidation and metadata reads.
        first = client.refresh()
        self.assertIs(client.refresh(), first)
        client.logos()
        # Then the same revision, sources and fallback information remain available.
        self.assertTrue(first.icon_info("Example LLM")["fallback"])
        self.assertEqual(client.coverage()["revision"], first.revision)
        self.assertEqual(len(first.sources("Example LLM", "/specs/text/contextWindowTokens")), 1)
        self.assertEqual(first.upstream_facts("Example LLM"), [])
        flaky = Client(base + "/flaky-python")
        previous = flaky.refresh()
        with self.assertRaises(ModelsError) as error:
            flaky.refresh()
        self.assertEqual(error.exception.code, "invalid_json")
        self.assertIs(flaky.current, previous)
        for path, code in [("missing", "not_found"), ("invalid", "invalid_json"), ("incompatible", "schema_incompatible"), ("bad-hash", "invalid_contract")]:
            with self.assertRaises(ModelsError) as error:
                Client(base + "/" + path).refresh()
            self.assertEqual(error.exception.code, code)
        with self.assertRaises(ModelsError) as error:
            Client(base + "/slow", timeout=0.005).refresh()
        self.assertEqual(error.exception.code, "timeout")
        self.assertEqual(Client(base + "/extension").refresh().revision, 1)

class UserAsyncHttpTests(unittest.IsolatedAsyncioTestCase):
    async def test_user_can_cancel_async_reads_and_revalidate_without_background_polling(self):
        import os
        import asyncio
        from lmspeed_models import AsyncClient
        base = os.environ.get("MODEL_TEST_BASE_URL")
        if not base:
            self.skipTest("HTTP contract service is configured by test-sdks")
        # Given an asynchronous caller controlling when requests run.
        async with AsyncClient(base + "/valid") as client:
            # When it refreshes and revalidates the catalogue.
            first = await client.refresh()
            # Then the same revision and logo/coverage metadata are accessible.
            self.assertIs(await client.refresh(), first)
            await client.logos()
            self.assertEqual((await client.coverage())["revision"], first.revision)
            self.assertEqual((await client.get("Example LLM")).id, "fixture-llm")
        async with AsyncClient(base + "/slow") as client:
            task = asyncio.create_task(client.refresh())
            await asyncio.sleep(0.005)
            task.cancel()
            with self.assertRaises(asyncio.CancelledError):
                await task

class UserPublishedDataTests(unittest.TestCase):
    def test_user_reads_the_actual_static_catalogue(self):
        import os
        path = os.environ.get("MODELS_DATA_FILE")
        if not path:
            self.skipTest("Actual SSG dataset is supplied by the SDK integration launcher")
        # Given the actual SSG dataset built from the tracked LMSpeed export.
        raw = Path(path).read_text()
        expected = json.loads(raw)
        # When the public Python entry point loads it offline.
        catalog = Catalog.from_json(raw)
        # Then all real identities resolve without duplicating the model count.
        self.assertEqual(len(catalog.models), expected["counts"]["models"])
        self.assertGreater(len(catalog.filter(task="image-generation")), 0)
        for alias in expected["data"]["aliases"]["models"]:
            self.assertEqual(catalog.resolve_model_id(alias["value"], alias["namespace"]).canonical_id, alias["canonicalId"])
