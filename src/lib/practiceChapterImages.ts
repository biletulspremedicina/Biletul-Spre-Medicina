// Aceleași fotografii pentru biblioteca de capitole și pagina seturilor.
const PHOTO = {
  overview: 'https://images.unsplash.com/photo-1755718670262-079fa2a36201?auto=format&fit=crop&w=360&h=180&q=80',
  cell: 'https://images.unsplash.com/photo-1778612506418-d33b3ad1f03b?auto=format&fit=crop&w=360&h=180&q=80',
  bones: 'https://images.unsplash.com/photo-1725398467934-18e46c88afaa?auto=format&fit=crop&w=360&h=180&q=80',
  muscle: 'https://images.unsplash.com/photo-1725399459286-c13790cecf80?auto=format&fit=crop&w=360&h=180&q=80',
  nerves: 'https://images.unsplash.com/photo-1725399078986-f75c61981dc5?auto=format&fit=crop&w=360&h=180&q=80',
  senses: 'https://commons.wikimedia.org/wiki/Special:FilePath/030608_Pupil.jpg?width=360',
};

export const PRACTICE_LIBRARY_HERO_IMAGE = 'https://www.gih.se/images/200.1cd239d71840e3b716bbd7a6/1668412349393/GIH_gamla_anatomibocker.jpg';

export function practiceChapterImageFor(title: string, large = false) {
  const name = title.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('ro-RO');
  let source = PHOTO.overview;
  if (name.includes('celul') || name.includes('tesut')) source = PHOTO.cell;
  else if (name.includes('osos') || name.includes('schelet') || name.includes('oase')) source = PHOTO.bones;
  else if (name.includes('muscular') || name.includes('muschi')) source = PHOTO.muscle;
  else if (name.includes('nerv')) source = PHOTO.nerves;
  else if (name.includes('analizator') || name.includes('simtur')) source = PHOTO.senses;
  return large ? source.replace('w=360', 'w=1200').replace('h=180', 'h=500').replace('width=360', 'width=1200') : source;
}
