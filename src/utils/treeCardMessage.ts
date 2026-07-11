export type TreeCardChild = {
  name: string;
  dob: string;
};

export type TreeCardMessagePayload = {
  ancestors: string[];
  branch: string;
  city: string;
  area: string;
  children: TreeCardChild[];
  createdAt: string;
  father: string;
  grandfather: string;
  personDob: string;
  personName: string;
  requestId: string;
  submitterEmail: string;
  submitterName: string;
  submitterPhone: string;
};

export function treeCardRequestId() {
  const part1 = Math.random().toString(36).slice(2, 6).toUpperCase();
  const part2 = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `REQ-${part1}-${part2}`;
}

export function buildTreeCardMessage(payload: TreeCardMessagePayload) {
  const lines: string[] = [];
  lines.push('بطاقة إضافة بيانات للشجرة');
  lines.push('');
  lines.push(`رقم الطلب: ${payload.requestId}`);
  lines.push(`العائلة (إجباري): ${payload.branch}`);
  if (payload.ancestors.length) {
    lines.push('سلسلة الأجداد:');
    payload.ancestors.forEach((value, index) => {
      lines.push(`الجد ${index + 1}: ${value}`);
    });
  } else {
    lines.push(`الجد 1 (إجباري): ${payload.grandfather}`);
  }
  lines.push(`الأب (إجباري): ${payload.father}`);
  lines.push(`الاسم (إجباري): ${payload.personName}`);
  lines.push(`تاريخ الميلاد (اختياري): ${payload.personDob}`);
  lines.push(`المدينة (اختياري): ${payload.city}`);
  lines.push(`الحي/القرية (اختياري): ${payload.area}`);
  lines.push('');
  lines.push('الأبناء (اختياري):');
  if (payload.children.length) {
    payload.children.forEach((child, index) => {
      lines.push(`${index + 1}- الاسم: ${child.name} — تاريخ الميلاد: ${child.dob}`);
    });
  } else {
    lines.push('(لا يوجد)');
  }
  lines.push('');
  lines.push('بيانات المرسل (إجباري):');
  lines.push(`الاسم: ${payload.submitterName}`);
  lines.push(`الجوال: ${payload.submitterPhone}`);
  lines.push(`البريد (اختياري): ${payload.submitterEmail}`);
  lines.push(`التاريخ: ${new Date(payload.createdAt).toLocaleString('ar-SA')}`);
  lines.push('');
  lines.push('__JSON__:');
  lines.push(
    JSON.stringify(
      {
        v: 1,
        kind: 'tree_card',
        branch_key: payload.branch,
        grandfather: payload.grandfather,
        ancestors: payload.ancestors,
        father: payload.father,
        name: payload.personName,
        birth_date_g: payload.personDob,
        city: payload.city,
        area: payload.area,
        children: payload.children,
        submitter: {
          name: payload.submitterName,
          phone: payload.submitterPhone,
          email: payload.submitterEmail,
        },
        created_at: payload.createdAt,
      },
      null,
      2,
    ),
  );
  return lines.join('\n');
}
