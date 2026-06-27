import type { Branch, FamilyEvent, TreePerson } from '../types';

export const branches: Branch[] = [
  {
    id: 'zidan',
    name: 'زيدان',
    fullName: 'زيدان بن مطلق بن زيدان',
    summary: 'فرع عائلي موثق ضمن ذرية مطلق بن زيدان.',
    familiesCount: 8,
    membersCount: 47,
  },
  {
    id: 'mazyad',
    name: 'مزيد',
    fullName: 'مزيد بن مطلق بن زيدان',
    summary: 'يضم عدة بيوت عائلية مترابطة ومتفرعة.',
    familiesCount: 7,
    membersCount: 39,
  },
  {
    id: 'zayed',
    name: 'زايد',
    fullName: 'زايد بن مطلق بن زيدان',
    summary: 'بيانات تجريبية محلية لعرض شكل الفرع.',
    familiesCount: 5,
    membersCount: 31,
  },
  {
    id: 'lahem',
    name: 'لاحم',
    fullName: 'لاحم بن مطلق بن زيدان',
    summary: 'فرع مستقل في العرض العام لشجرة العائلة.',
    familiesCount: 4,
    membersCount: 24,
  },
  {
    id: 'melhem',
    name: 'ملحم',
    fullName: 'ملحم بن مطلق بن زيدان',
    summary: 'أسماء وأرقام تجريبية وليست بيانات حقيقية.',
    familiesCount: 6,
    membersCount: 34,
  },
];

export const tree: TreePerson = {
  id: 'root',
  name: 'مطلق بن زيدان',
  meta: 'الجد الجامع',
  children: [
    {
      id: 'zidan',
      name: 'زيدان بن مطلق',
      children: [
        {
          id: 'khamis',
          name: 'خميس بن زيدان',
          children: [
            { id: 'abdullah-k', name: 'عبدالله بن خميس', meta: 'الرياض' },
            { id: 'mohammed-k', name: 'محمد بن خميس', meta: 'القصيم' },
          ],
        },
        {
          id: 'abdullah-z',
          name: 'عبدالله بن زيدان',
          children: [{ id: 'saad-a', name: 'سعد بن عبدالله', meta: 'الرياض' }],
        },
      ],
    },
    {
      id: 'mazyad',
      name: 'مزيد بن مطلق',
      children: [
        { id: 'khamis-m', name: 'خميس بن مزيد', meta: 'فرع تجريبي' },
        { id: 'salaf', name: 'صلف بن مزيد', meta: 'فرع تجريبي' },
        { id: 'salal', name: 'صلال بن مزيد', meta: 'فرع تجريبي' },
      ],
    },
    { id: 'zayed', name: 'زايد بن مطلق', meta: 'تضاف بياناته لاحقًا' },
    { id: 'lahem', name: 'لاحم بن مطلق', meta: 'تضاف بياناته لاحقًا' },
    { id: 'melhem', name: 'ملحم بن مطلق', meta: 'تضاف بياناته لاحقًا' },
  ],
};

export const events: FamilyEvent[] = [
  {
    id: 'event-1',
    category: 'happy',
    categoryLabel: 'فرح',
    title: 'مولود جديد',
    person: 'أسرة عبدالله الزيدان',
    date: '18 يونيو 2026',
    details: 'نبارك للأسرة قدوم المولود، جعله الله من مواليد السعادة.',
    branch: 'فرع زيدان',
  },
  {
    id: 'event-2',
    category: 'happy',
    categoryLabel: 'مناسبة',
    title: 'تخرج',
    person: 'محمد بن سعد',
    date: '22 يونيو 2026',
    details: 'ألف مبروك التخرج، ومنها إلى أعلى المراتب بإذن الله.',
    branch: 'فرع مزيد',
  },
  {
    id: 'event-3',
    category: 'health',
    categoryLabel: 'اطمئنان',
    title: 'خروج من المستشفى',
    person: 'أحد أبناء العائلة',
    date: '15 يونيو 2026',
    details: 'الحمد لله على السلامة، نسأل الله له تمام الصحة والعافية.',
    branch: 'فرع لاحم',
  },
  {
    id: 'event-4',
    category: 'condolence',
    categoryLabel: 'تعزية',
    title: 'عزاء',
    person: 'بيانات تجريبية',
    date: '12 يونيو 2026',
    details: 'عظم الله أجركم وأحسن عزاءكم وغفر لميتكم.',
    branch: 'فرع ملحم',
  },
];
