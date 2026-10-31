import { test, expect } from "@playwright/test";
import { isSameOriginRequest } from "../src/lib/backend/request-origin";
test("preview POST validates the public request host despite an internal Next URL", () => {
  expect(
    isSameOriginRequest(
      new Request("http://localhost:4300/api/preview", {
        headers: { host: "127.0.0.1:4300", origin: "http://127.0.0.1:4300" },
      }),
    ),
  ).toBe(true);
  expect(
    isSameOriginRequest(
      new Request("http://internal/api/preview", {
        headers: {
          host: "archive.example",
          origin: "https://archive.example",
          "x-forwarded-proto": "https",
        },
      }),
    ),
  ).toBe(true);
});
test("foreign origins and forged forwarded hosts cannot authorize a preview write", () => {
  const cases: Record<string, string>[] = [
    {
      host: "archive.example",
      origin: "https://evil.example",
      "x-forwarded-host": "evil.example",
      "x-forwarded-proto": "https",
    },
    { host: "archive.example", origin: "null" },
    {
      host: "archive.example",
      origin: "https://archive.example",
      "sec-fetch-site": "cross-site",
    },
  ];
  for (const headers of cases)
    expect(
      isSameOriginRequest(
        new Request("https://archive.example/api/preview", { headers }),
      ),
    ).toBe(false);
});
