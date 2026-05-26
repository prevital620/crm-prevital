import type { Metadata } from "next";
import LegalPage from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Politica de privacidad | Prevital",
  description:
    "Politica de privacidad y tratamiento de datos personales de Prevital Antioquia SAS.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      eyebrow="Informacion legal"
      title="Politica de privacidad"
      updatedAt="26 de mayo de 2026"
    >
      <p>
        Prevital Antioquia SAS informa que recolecta y trata datos personales
        como nombre, telefono, correo electronico, mensajes enviados por
        WhatsApp y demas informacion necesaria para gestionar solicitudes,
        inscripciones, campanas, atencion comercial y seguimiento a usuarios
        interesados en nuestros servicios y experiencias de bienestar.
      </p>

      <p>
        Los datos podran ser recolectados a traves de WhatsApp, formularios,
        llamadas, campanas digitales, CRM y otros canales autorizados por el
        usuario.
      </p>

      <p>
        La finalidad del tratamiento incluye: responder solicitudes de
        informacion, confirmar inscripciones, coordinar experiencias de
        bienestar, realizar seguimiento comercial, mejorar la atencion al
        usuario y cumplir obligaciones legales aplicables.
      </p>

      <p>
        El usuario podra solicitar conocer, actualizar, rectificar o eliminar
        sus datos personales escribiendo a:{" "}
        <a className="font-semibold text-[#3F6952] underline" href="mailto:gerencia@prevital.co">
          gerencia@prevital.co
        </a>
      </p>

      <p>
        Prevital Antioquia SAS se compromete a tratar la informacion de forma
        responsable, confidencial y conforme a la normativa aplicable en
        Colombia.
      </p>
    </LegalPage>
  );
}
