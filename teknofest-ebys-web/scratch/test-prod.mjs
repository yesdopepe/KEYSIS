async function testE2E() {
  const cookieJar = [];

  console.log("--- ADIM 1: AI ile Dilekçe Üretimi İstemi ---");
  const sohbetId = "prod-test-" + Date.now();
  const apiRes = await fetch("http://localhost:3002/api/asistan", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Referer: "http://localhost:3002/basvuru/asistan",
    },
    body: JSON.stringify({
      id: sohbetId,
      messages: [
        {
          role: "user",
          parts: [
            {
              type: "text",
              text: "Çöp konteynerinin yenilenmesi için belediye temizlik işlerine hitaben resmi bir dilekçe hazırla",
            },
          ],
        },
      ],
    }),
  });

  const setCookie = apiRes.headers.get("set-cookie");
  if (setCookie) cookieJar.push(setCookie.split(";")[0]);

  console.log("API Status:", apiRes.status);
  const reader = apiRes.body.getReader();
  const decoder = new TextDecoder();
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    text += decoder.decode(value, { stream: true });
  }
  console.log("Stream bytes received:", text.length);

  // Check if tool call or belgeId is in stream
  const belgeMatch = text.match(/"belgeId"\s*:\s*"([^"]+)"/);
  const belgeId = belgeMatch ? belgeMatch[1] : null;
  console.log("Dilekçe Belge ID:", belgeId);

  console.log(
    "\n--- ADIM 2: Vatandaş Tuval Sayfası (GET /basvuru/asistan/" +
      sohbetId +
      ") ---"
  );
  const pageUrl =
    "http://localhost:3002/basvuru/asistan/" +
    sohbetId +
    (belgeId ? "?belge=" + belgeId : "");
  const pageRes = await fetch(pageUrl, {
    headers: {
      Cookie: cookieJar.join("; "),
    },
  });
  console.log("Page URL:", pageUrl);
  console.log("Page Response Status:", pageRes.status);

  const pageHtml = await pageRes.text();
  const hasError =
    pageHtml.includes("Belge bulunamadı") ||
    pageHtml.includes("erişim yetkiniz yok");
  console.log("Page has privilege / not found error:", hasError);

  if (pageRes.status === 200 && !hasError) {
    console.log(">>> SUCCESS: Production page loaded cleanly with HTTP 200 and no privilege errors! <<<");
  } else {
    console.log(">>> FAILURE: Status", pageRes.status, "hasError:", hasError);
  }
}

testE2E().catch(console.error);
