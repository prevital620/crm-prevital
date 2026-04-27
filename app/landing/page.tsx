export default function Landing() {
  return (
    <main style={{ fontFamily: "sans-serif", background: "#f7f7f7" }}>
      
      {/* HERO */}
      <section style={{ textAlign: "center", padding: "60px 20px" }}>
        <h1 style={{ fontSize: "40px", color: "#4f6f52" }}>
          PREVITAL ODONTOLOGÍA
        </h1>
        <p style={{ fontSize: "20px", marginTop: "10px" }}>
          Tu sonrisa, nuestra prioridad
        </p>

        <a
          href="https://wa.me/573004937787?text=Hola%2C%20quiero%20agendar%20una%20cita%20odontol%C3%B3gica%20en%20Prevital"
          target="_blank"
        >
          <button
            style={{
              marginTop: "20px",
              padding: "15px 25px",
              fontSize: "16px",
              backgroundColor: "#4f6f52",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Agenda tu cita
          </button>
        </a>
      </section>

      {/* SERVICIOS */}
      <section style={{ padding: "40px 20px", textAlign: "center" }}>
        <h2>Servicios</h2>
        <ul style={{ listStyle: "none", padding: 0 }}>
          <li>Limpieza dental</li>
          <li>Blanqueamiento</li>
          <li>Diseño de sonrisa</li>
          <li>Valoración odontológica</li>
          <li>Ortodoncia</li>
          <li>Rehabilitación oral</li>
        </ul>
      </section>

      {/* BENEFICIOS */}
      <section style={{ padding: "40px 20px", textAlign: "center" }}>
        <h2>¿Por qué elegirnos?</h2>
        <p>Atención profesional</p>
        <p>Diagnóstico personalizado</p>
        <p>Planes accesibles</p>
        <p>Acompañamiento completo</p>
      </section>

      {/* CONTACTO */}
      <section style={{ padding: "40px 20px", textAlign: "center" }}>
        <h2>Contáctanos</h2>
        <p>Medellín</p>
        <p>Lunes a viernes 8:00 a.m. - 5:00 p.m.</p>

        <a
          href="https://wa.me/573004937787"
          target="_blank"
        >
          <button
            style={{
              marginTop: "10px",
              padding: "12px 20px",
              backgroundColor: "#4f6f52",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            WhatsApp
          </button>
        </a>
      </section>
    </main>
  );
}