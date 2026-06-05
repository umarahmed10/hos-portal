import { ClientCodeEntry }  from "@/components/client/ClientCodeEntry";
import { css }              from "@/lib/styles";

export const dynamic = "force-dynamic";

export default function ClientPage() {
  return (
    <div style={{ ...css.app, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <ClientCodeEntry />
    </div>
  );
}
