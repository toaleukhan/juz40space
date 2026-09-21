import imgAngl from '../assets/subjects/Английский_Язык.webp';
import imgBio from '../assets/subjects/Биология.webp';
import imgWHist from '../assets/subjects/Всемирная_История.webp';
import imgGeo from '../assets/subjects/География.webp';
import imgGeom from '../assets/subjects/Геометрия.webp';
import imgInfo from '../assets/subjects/Информатика.webp';
import imgHist from '../assets/subjects/История_Казахстана.webp';
import imgLit from '../assets/subjects/Казахская_Литература.webp';
import imgKaz from '../assets/subjects/Казахский_Язык.webp';
import imgLogic from '../assets/subjects/Логика.webp';
import imgMath from '../assets/subjects/Математика.webp';
import imgRus from '../assets/subjects/Русский_Язык.webp';
import imgChem from '../assets/subjects/Химия.webp';

// Викторинаның пәніне қарай сол пәннің жұлдыз-маскоты (сайттың басқа
// беттеріндегі сияқты). Физикаға жеке маскот жоқ — «ойлайтын» жұлдыз.
const BY_CODE = {
  'МАТ': imgMath, 'ГЕОМ': imgGeom, 'ТІЛ': imgKaz, 'БИО': imgBio, 'ИНФО': imgInfo,
  'ГЕО': imgGeo, 'ТАРИХ': imgHist, 'РУС': imgRus, 'ХИМ': imgChem, 'МС': imgLogic,
  'ӘДЕБ': imgLit, 'АНГЛ': imgAngl, 'ДЖТ': imgWHist,
};

export const mascotFor = (subject) => BY_CODE[subject] || imgLogic;
// Жеңіс сәтіне — кітап ұстаған жұлдыз (қазақ тілі).
export const winnerMascot = imgKaz;
