import type { CategoryDef, PromptPill, Work } from '@/types'

// Category + artwork data.
// Images are sourced from public museum collections (Met Open Access, Smithsonian)
// of West African / Yoruba / Nigerian works — visual placeholders for the
// YSMA catalogue. Swap in real catalogue images when ready.

export const CATEGORIES: CategoryDef[] = [
  { id: 'all', label: 'All works', count: 248 },
  { id: 'bronze', label: 'Benin Bronzes', count: 34 },
  { id: 'mask', label: 'Masks & Headdresses', count: 41 },
  { id: 'terracotta', label: 'Nok Terracotta', count: 22 },
  { id: 'textile', label: 'Textiles & Adire', count: 38 },
  { id: 'sacred', label: 'Sacred Objects', count: 27 },
  { id: 'contemporary', label: 'Contemporary', count: 56 },
  { id: 'photo', label: 'Photography', count: 30 },
]

const bronze: Work[] = [
  {
    id: 'b1',
    title: 'Head of an Oba',
    maker: 'Edo / Benin Kingdom',
    date: '16th c.',
    tag: 'Bronze',
    img: 'https://images.metmuseum.org/CRDImages/aa/original/DP231460.jpg',
    span: 'feature',
  },
  {
    id: 'b2',
    title: 'Plaque, Warrior with Attendants',
    maker: 'Edo / Benin Kingdom',
    date: '16–17th c.',
    tag: 'Bronze',
    img: 'https://images.metmuseum.org/CRDImages/aa/original/DP231462.jpg',
  },
  {
    id: 'b3',
    title: 'Hip Pendant Mask, Iyoba',
    maker: 'Edo / Benin Kingdom',
    date: '16th c.',
    tag: 'Ivory',
    img: 'https://images.metmuseum.org/CRDImages/aa/original/DP231458.jpg',
  },
  {
    id: 'b4',
    title: 'Memorial Head of a King',
    maker: 'Edo / Benin Kingdom',
    date: '18th c.',
    tag: 'Bronze',
    img: 'https://images.metmuseum.org/CRDImages/aa/original/DP-13207-001.jpg',
  },
  {
    id: 'b5',
    title: 'Cock figure for ancestral altar',
    maker: 'Edo / Benin Kingdom',
    date: '18th c.',
    tag: 'Bronze',
    img: 'https://ids.si.edu/ids/deliveryService?id=NMAfA-2005-6-9_001',
  },
]

const mask: Work[] = [
  {
    id: 'm1',
    title: 'Gelede Mask',
    maker: 'Yoruba peoples',
    date: 'early 20th c.',
    tag: 'Wood, pigment',
    img: 'https://images.metmuseum.org/CRDImages/aa/original/DP231474.jpg',
    span: 'feature',
  },
  {
    id: 'm2',
    title: 'Epa Headdress, Olumeye',
    maker: 'Yoruba, Ekiti region',
    date: 'c.1920',
    tag: 'Wood',
    img: 'https://images.metmuseum.org/CRDImages/aa/original/DP231468.jpg',
  },
  {
    id: 'm3',
    title: 'Igbo Mmwo Maiden Mask',
    maker: 'Igbo peoples',
    date: 'early 20th c.',
    tag: 'Wood, kaolin',
    img: 'https://images.metmuseum.org/CRDImages/aa/original/DP231472.jpg',
  },
  {
    id: 'm4',
    title: 'Ekpe Society Mask',
    maker: 'Cross River, Ejagham',
    date: '19th c.',
    tag: 'Wood, skin',
    img: 'https://ids.si.edu/ids/deliveryService?id=NMAfA-79-16-104_002',
  },
  {
    id: 'm5',
    title: 'Headdress, Egungun',
    maker: 'Yoruba peoples',
    date: '20th c.',
    tag: 'Cloth, beads',
    img: 'https://images.metmuseum.org/CRDImages/aa/original/DP231476.jpg',
  },
]

const terracotta: Work[] = [
  {
    id: 't1',
    title: 'Standing Figure',
    maker: 'Nok civilisation',
    date: 'c. 500 BCE – 200 CE',
    tag: 'Terracotta',
    img: 'https://images.metmuseum.org/CRDImages/aa/original/DP231454.jpg',
    span: 'feature',
  },
  {
    id: 't2',
    title: 'Equestrian Figure',
    maker: 'Djenné, Inland Niger Delta',
    date: '13–15th c.',
    tag: 'Terracotta',
    img: 'https://images.metmuseum.org/CRDImages/aa/original/DP231456.jpg',
  },
  {
    id: 't3',
    title: 'Seated Dignitary',
    maker: 'Nok civilisation',
    date: 'c. 500 BCE',
    tag: 'Terracotta',
    img: 'https://images.metmuseum.org/CRDImages/aa/original/DP231452.jpg',
  },
  {
    id: 't4',
    title: 'Head of a Ruler',
    maker: 'Ife, Yoruba',
    date: '12–14th c.',
    tag: 'Terracotta',
    span: 'wide',
    img: 'https://images.metmuseum.org/CRDImages/aa/original/DP231450.jpg',
  },
]

const textile: Work[] = [
  {
    id: 'x1',
    title: 'Adire Eleko, Olokun design',
    maker: 'Yoruba, Abeokuta',
    date: 'mid-20th c.',
    tag: 'Indigo, cassava',
    img: 'https://ids.si.edu/ids/deliveryService?id=NMAfA-2007-12-2_001',
    span: 'feature',
  },
  {
    id: 'x2',
    title: 'Aso Oke, Etu pattern',
    maker: 'Yoruba weavers, Iseyin',
    date: '20th c.',
    tag: 'Cotton, silk',
    img: 'https://ids.si.edu/ids/deliveryService?id=NMAfA-85-15-1_001',
  },
  {
    id: 'x3',
    title: 'Akwete Cloth',
    maker: 'Igbo, Akwete',
    date: '20th c.',
    tag: 'Cotton',
    img: 'https://ids.si.edu/ids/deliveryService?id=NMAfA-85-15-12_001',
  },
  {
    id: 'x4',
    title: 'Adire Alabere, Stitched',
    maker: 'Yoruba, Ibadan',
    date: '1960s',
    tag: 'Indigo, raffia',
    img: 'https://ids.si.edu/ids/deliveryService?id=NMAfA-86-12-22_001',
  },
  {
    id: 'x5',
    title: 'Wrapper, Akwete weave',
    maker: 'Igbo peoples',
    date: '1970s',
    tag: 'Cotton',
    img: 'https://ids.si.edu/ids/deliveryService?id=NMAfA-85-15-15_001',
  },
]

const sacred: Work[] = [
  {
    id: 's1',
    title: 'Iroke Ifa, Divination Tapper',
    maker: 'Yoruba peoples',
    date: '19th c.',
    tag: 'Ivory',
    img: 'https://images.metmuseum.org/CRDImages/aa/original/DP231480.jpg',
    span: 'feature',
  },
  {
    id: 's2',
    title: 'Agere Ifa, Divination Cup',
    maker: 'Yoruba peoples',
    date: '19th c.',
    tag: 'Wood',
    img: 'https://images.metmuseum.org/CRDImages/aa/original/DP231482.jpg',
  },
  {
    id: 's3',
    title: 'Opon Ifa, Divination Tray',
    maker: 'Yoruba peoples',
    date: '19th c.',
    tag: 'Wood',
    img: 'https://images.metmuseum.org/CRDImages/aa/original/DP231484.jpg',
  },
  {
    id: 's4',
    title: 'Eshu Staff',
    maker: 'Yoruba peoples',
    date: 'early 20th c.',
    tag: 'Wood, beads',
    img: 'https://images.metmuseum.org/CRDImages/aa/original/DP231486.jpg',
  },
]

const contemporary: Work[] = [
  {
    id: 'c1',
    title: 'Tutu (study)',
    maker: 'Ben Enwonwu',
    date: '1973',
    tag: 'Oil on canvas',
    span: 'feature',
  },
  {
    id: 'c2',
    title: "Drummers of My Father's Compound",
    maker: 'Bruce Onobrakpeya',
    date: '1989',
    tag: 'Etching',
  },
  { id: 'c3', title: 'Man with Hourglass Drum', maker: 'Yusuf Grillo', date: '1994', tag: 'Oil on canvas' },
  { id: 'c4', title: 'Untitled, Lagos series', maker: 'Peju Alatise', date: '2018', tag: 'Mixed media' },
  { id: 'c5', title: 'The Storyteller', maker: 'Nike Davies-Okundaye', date: '2010', tag: 'Adire on cotton' },
]

const photo: Work[] = [
  {
    id: 'p1',
    title: 'Sitter at Studio Mama',
    maker: "J.D. 'Okhai Ojeikere",
    date: '1970',
    tag: 'Gelatin silver',
    span: 'feature',
  },
  { id: 'p2', title: 'Onile Gogoro hairstyle', maker: "J.D. 'Okhai Ojeikere", date: '1975', tag: 'Gelatin silver' },
  { id: 'p3', title: 'Modupe', maker: 'Solomon Osagie Alonge', date: '1948', tag: 'Gelatin silver' },
  { id: 'p4', title: 'Iya Agba', maker: 'Anonymous, Ibadan studio', date: 'c.1962', tag: 'Gelatin silver' },
]

const all: Work[] = [
  bronze[0],
  mask[1],
  sacred[0],
  terracotta[1],
  textile[0],
  photo[1],
  contemporary[1],
  bronze[2],
].map((w, i) => ({ ...w, span: i === 0 ? 'feature' : i === 5 ? 'wide' : undefined }))

export const WORKS: Record<string, Work[]> = {
  all,
  bronze,
  mask,
  terracotta,
  textile,
  sacred,
  contemporary,
  photo,
}

export const PROMPT_PILLS: PromptPill[] = [
  { text: 'Tell me about the oldest work' },
  { text: 'What traditions does this collection hold?' },
]

export const CURIOSITY: string[] = [
  'How did the Nok civilisation disappear?',
  'What were Gelede masks used for?',
  'Why is the Iyoba pendant carved from ivory?',
  'Which artists carry the Adire tradition today?',
  'What does the Iroke Ifa tap against?',
]
