// production-да JWT_SECRET орнатылмаса, дереу тоқтатамыз — әйтпесе бәрі
// осы файлдағы белгілі хардкод мәнмен қолтаңбаланып, кез келген адам өз
// JWT токенін жасап, кез келген куратор/координатор/admin ретінде кіре алар
// еді. Жергілікті дамытуда (NODE_ENV !== 'production') ыңғайлылық үшін
// әдепкі мән қалады.
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET орнатылмаған — production-да міндетті түрде керек.');
}

module.exports = process.env.JWT_SECRET || 'juz40_secret_key';
