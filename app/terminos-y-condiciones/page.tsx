import type { Metadata } from "next";
import LegalPage from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terminos y condiciones | Prevital",
  description:
    "Terminos y condiciones de uso de canales digitales de Prevital Antioquia SAS.",
};

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Informacion legal"
      title="Terminos y condiciones"
      updatedAt="26 de mayo de 2026"
    >
      <p>
        El uso de los canales digitales de Prevital Antioquia SAS, incluyendo
        WhatsApp, formularios, paginas web, campanas publicitarias y CRM,
        implica la aceptacion de estas condiciones.
      </p>

      <p>
        La informacion enviada por los usuarios sera utilizada para atencion,
        registro, seguimiento y coordinacion de servicios o experiencias de
        bienestar.
      </p>

      <p>
        La participacion en campanas promocionales, sorteos o experiencias sin
        costo no garantiza que el usuario sea seleccionado. La asignacion de
        cupos esta sujeta a disponibilidad, validacion y confirmacion por parte
        del equipo de Prevital.
      </p>

      <p>
        Los servicios, valoraciones o experiencias ofrecidas estan sujetos a
        disponibilidad de agenda, criterios internos de atencion y confirmacion
        previa.
      </p>

      <p>
        Para consultas relacionadas con estos terminos, el usuario puede
        escribir a:{" "}
        <a className="font-semibold text-[#3F6952] underline" href="mailto:gerencia@prevital.co">
          gerencia@prevital.co
        </a>
      </p>
    </LegalPage>
  );
}
