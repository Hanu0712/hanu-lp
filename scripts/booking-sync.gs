/**
 * Hanu — 無料Zoom相談 予約一覧 自動転記スクリプト
 *
 * 使い方:
 *   1. Google スプレッドシートを新規作成（タブ名を「予約一覧」に）
 *   2. メニュー: 拡張機能 → Apps Script
 *   3. このコードを丸ごと貼り付けて保存
 *   4. 関数 syncBookingsToSheet を 1 回手動実行（Gmail 権限を承認）
 *   5. ⏰ トリガー → 15 分おきに syncBookingsToSheet を起動
 *
 * 動作:
 *   - Gmail で 件名「【Zoom相談予約】」のメールを検索
 *   - 「転記済み」ラベルが付いていないものから内容を抽出 → シートに追記
 *   - 「転記済み」ラベルを付与して二重転記を防止
 */

const SHEET_NAME = '予約一覧';
const PROCESSED_LABEL = '転記済み';
const SUBJECT_KEYWORD = '【Zoom相談予約】';

const HEADERS = [
  '受付日時', '相談日時', 'お名前', 'カナ', 'メール',
  'Instagram', 'パーティー内容', 'ご相談内容', 'ステータス', 'メモ'
];

function syncBookingsToSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);

  // 初回ヘッダー
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#0e0e0c')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.setColumnWidths(1, HEADERS.length, 140);
    sheet.setColumnWidth(8, 280); // ご相談内容を広めに
    sheet.setColumnWidth(10, 220); // メモを広めに
  }

  let label = GmailApp.getUserLabelByName(PROCESSED_LABEL);
  if (!label) label = GmailApp.createLabel(PROCESSED_LABEL);

  const query = `subject:"${SUBJECT_KEYWORD}" -label:${PROCESSED_LABEL}`;
  const threads = GmailApp.search(query, 0, 50);

  let added = 0;
  for (const thread of threads) {
    for (const msg of thread.getMessages()) {
      if (!msg.getSubject().includes(SUBJECT_KEYWORD)) continue;
      const parsed = parseBody(msg.getPlainBody());
      if (!parsed) continue;
      const receivedAt = Utilities.formatDate(msg.getDate(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
      sheet.appendRow([
        receivedAt,
        parsed.dateTime,
        parsed.name,
        parsed.kana,
        parsed.email,
        parsed.instagram,
        parsed.partyType,
        parsed.message,
        '',
        ''
      ]);
      added++;
    }
    thread.addLabel(label);
  }

  console.log(`転記件数: ${added}`);
}

/**
 * 15分おきに syncBookingsToSheet を自動実行するトリガーをインストール
 * （初回 1 回だけ実行すればOK）
 */
function setupAutoSync() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'syncBookingsToSheet')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('syncBookingsToSheet')
    .timeBased()
    .everyMinutes(15)
    .create();

  console.log('15分おきの自動同期を有効化しました');
}

/**
 * 通知メール本文（api/booking.js の notificationBody）から各フィールドを抽出
 */
function parseBody(body) {
  if (!body) return null;
  const grab = re => {
    const m = body.match(re);
    return m ? m[1].trim() : '';
  };

  const dateTime = grab(/日時[:：]\s*(.+)/);
  const nameLine = body.match(/お名前[:：]\s*([^（(\n]+)[（(]([^）)\n]+)[）)]/);
  const email = grab(/メール[:：]\s*(\S+)/);
  const instagram = grab(/Instagram[:：]\s*(\S+)/);
  const partyType = grab(/パーティー内容[:：]\s*(.+)/);
  // ご相談内容は複数行になり得るので、次の区切り線または末尾まで
  const msgMatch = body.match(/ご相談内容[:：]\s*([\s\S]+?)(?=\n[―━─]{3,}|\nパーティープロデューサー|$)/);
  const message = msgMatch ? msgMatch[1].trim() : '';

  if (!dateTime || !nameLine || !email) return null;

  return {
    dateTime,
    name: nameLine[1].trim(),
    kana: nameLine[2].trim(),
    email,
    instagram,
    partyType,
    message
  };
}
