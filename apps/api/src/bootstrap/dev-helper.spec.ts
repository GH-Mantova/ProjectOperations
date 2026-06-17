import { renderDevHelper } from "./create-app";

describe("renderDevHelper (dev API root response)", () => {
  it("points the developer to the Vite dev server and Swagger docs", () => {
    const html = renderDevHelper("http://localhost:5173", "/api/docs");
    expect(html).toContain("http://localhost:5173");
    expect(html).toContain("/api/docs");
    expect(html).toContain("API dev server");
  });

  it("does not serve any built frontend asset markers", () => {
    const html = renderDevHelper("http://localhost:5173", "/api/docs");
    expect(html.toLowerCase()).toContain("does not serve");
  });
});
