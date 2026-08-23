export const downloadBlob = (blob: Blob, filename: string) => {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const handleBriefingExport = (
  exportFormat: string, 
  data: { baseEntityId: number; queryText: string; execSummary: string; keyFindings: string; risks: string; actions: string; selectedMemoryIds: number[] },
  onComplete: () => void
) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const fileName = `Defacto_Summary_Briefing_${todayStr}`;

  if (exportFormat === 'JSON') {
    const exportData = {
      metadata: { baseEntityId: data.baseEntityId, generatedAt: new Date().toISOString(), queryText: data.queryText, selectedMemoryIds: data.selectedMemoryIds },
      report: {
        executiveSummary: data.execSummary,
        keyFindings: data.keyFindings.split('\n- ').filter(Boolean),
        riskAndWarnings: data.risks.split('\n- ').filter(Boolean),
        recommendedActions: data.actions.split('\n- ').filter(Boolean)
      }
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json;charset=utf-8;' });
    downloadBlob(blob, `${fileName}.json`);
  } 
  else if (exportFormat === 'MD' || exportFormat === 'TXT') {
    const textContent = `### 📊 총평 (Executive Summary)\n${data.execSummary}\n\n### 🔍 주요 발견 (Key Findings)\n- ${data.keyFindings}\n\n### ⚠️ 위험 및 경고 (Risk & Warnings)\n- ${data.risks}\n\n### 💡 행동 지침 (Recommended Actions)\n- ${data.actions}`;
    const blob = new Blob(["\uFEFF" + textContent], { type: 'text/plain;charset=utf-8;' });
    downloadBlob(blob, `${fileName}.${exportFormat.toLowerCase()}`);
  }
  else if (exportFormat === 'WORD') {
    const htmlString = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"><title>Summary Briefing Report</title></head>
      <body style="font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;">
        <h1>AI 요약 리포트</h1>
        <p><strong>생성일:</strong> ${todayStr}</p>
        <h2 style="color: #4f46e5;">📊 총평 (Executive Summary)</h2>
        <p>${data.execSummary}</p>
        <h2 style="color: #10b981;">🔍 주요 발견 (Key Findings)</h2>
        <ul>${data.keyFindings.split('\n- ').filter(Boolean).map((item: string) => `<li>${item}</li>`).join('')}</ul>
        <h2 style="color: #ef4444;">⚠️ 위험 및 경고 (Risk & Warnings)</h2>
        <ul>${data.risks.split('\n- ').filter(Boolean).map((item: string) => `<li>${item}</li>`).join('')}</ul>
        <h2 style="color: #f59e0b;">💡 행동 지침 (Recommended Actions)</h2>
        <ul>${data.actions.split('\n- ').filter(Boolean).map((item: string) => `<li>${item}</li>`).join('')}</ul>
      </body>
      </html>
    `;
    const blob = new Blob(['\ufeff' + htmlString], { type: 'application/msword' });
    downloadBlob(blob, `${fileName}.doc`);
  }
  else if (exportFormat === 'PDF') {
    const printWindow = window.open('', '', 'width=800,height=900');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${fileName}</title>
            <style>
              body { font-family: 'Pretendard', 'Malgun Gothic', sans-serif; line-height: 1.6; padding: 40px; color: #333; }
              h1 { color: #111; border-bottom: 2px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
              h2 { margin-top: 30px; font-size: 18px; }
              .risk { color: #ef4444; background: #fef2f2; padding: 15px; border-radius: 8px; border: 1px solid #fca5a5; }
              ul { padding-left: 20px; }
              li { margin-bottom: 8px; }
            </style>
          </head>
          <body>
            <h1>AI 요약 리포트 (Summary Briefing)</h1>
            <p><strong>생성일:</strong> ${new Date().toLocaleDateString()}</p>
            <p><strong>대상 주체 ID:</strong> ${data.baseEntityId}</p>
            <h2 style="color: #4f46e5;">📊 총평 (Executive Summary)</h2>
            <p>${data.execSummary}</p>
            <h2 style="color: #10b981;">🔍 주요 발견 (Key Findings)</h2>
            <ul>${data.keyFindings.split('\n- ').filter(Boolean).map((item: string) => `<li>${item}</li>`).join('')}</ul>
            <h2 style="color: #ef4444;">⚠️ 위험 및 경고 (Risk & Warnings)</h2>
            <div class="risk"><ul style="margin:0;">${data.risks.split('\n- ').filter(Boolean).map((item: string) => `<li>${item}</li>`).join('')}</ul></div>
            <h2 style="color: #f59e0b;">💡 행동 지침 (Recommended Actions)</h2>
            <ul>${data.actions.split('\n- ').filter(Boolean).map((item: string) => `<li>${item}</li>`).join('')}</ul>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  }

  onComplete();
};