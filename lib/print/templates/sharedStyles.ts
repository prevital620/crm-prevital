const sharedPrintStyles = `
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color: #1f2937; margin: 0; background: #fff; }
    .page { max-width: 900px; margin: 0 auto; padding: 28px 32px 40px; }
    .header {
      display:flex; justify-content:space-between; gap:24px;
      border-bottom: 3px solid #7FA287;
      padding-bottom:18px; margin-bottom:24px;
    }
    .brand h1 { margin:0; font-size:30px; color:#24312a; letter-spacing:.2px; }
    .brand p { margin:6px 0 0; color:#5f7d66; font-size:14px; }
    .pill {
      display:inline-block; padding:6px 12px; border-radius:999px;
      background:#eef8f1; color:#2f5e46; font-size:12px; font-weight:700;
      border:1px solid #cfe7d6;
      margin-bottom:8px;
    }
    .box {
      border:1px solid #d6e8da; border-radius:18px; padding:16px 18px;
      margin-bottom:18px; background:#fff;
    }
    .box h2 { margin:0 0 12px; font-size:18px; color:#24312a; }
    .grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px 18px; }
    .item-label { font-size:12px; color:#64748b; margin-bottom:4px; text-transform:uppercase; letter-spacing:.3px; }
    .item-value { font-size:15px; font-weight:600; color:#111827; }
    .text-block { white-space:pre-wrap; line-height:1.65; font-size:14px; }
    ul { margin:0; padding-left:18px; line-height:1.6; }
    .signatures { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:28px; margin-top:34px; }
    .signature-line { border-top:1px solid #94a3b8; padding-top:10px; font-size:13px; color:#475569; }
    .muted { color:#64748b; font-size:12px; }
    .table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    .table th, .table td { border: 1px solid #d6e8da; padding: 8px 10px; font-size: 13px; text-align: left; }
    .table th { background: #f3f8f4; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
`;

export default sharedPrintStyles;
