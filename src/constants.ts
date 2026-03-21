export interface LegoSet {
  number: string;
  name: string;
  image: string;
  year?: string;
}

export const POPULAR_LEGO_SETS: LegoSet[] = [
  // Icons / Creator Expert
  { number: '10316', name: 'Rivendell (반지의 제왕: 리븐델)', image: 'https://images.brickset.com/sets/images/10316-1.jpg', year: '2023' },
  { number: '10305', name: 'Lion Knights\' Castle (사자 기사의 성)', image: 'https://images.brickset.com/sets/images/10305-1.jpg', year: '2022' },
  { number: '10302', name: 'Optimus Prime (옵티머스 프라임)', image: 'https://images.brickset.com/sets/images/10302-1.jpg', year: '2022' },
  { number: '10294', name: 'Titanic (타이타닉)', image: 'https://images.brickset.com/sets/images/10294-1.jpg', year: '2021' },
  { number: '10274', name: 'Ghostbusters ECTO-1 (고스트버스터즈 ECTO-1)', image: 'https://images.brickset.com/sets/images/10274-1.jpg', year: '2020' },
  { number: '10276', name: 'Colosseum (콜로세움)', image: 'https://images.brickset.com/sets/images/10276-1.jpg', year: '2020' },
  { number: '10281', name: 'Bonsai Tree (분재 나무)', image: 'https://images.brickset.com/sets/images/10281-1.jpg', year: '2021' },
  { number: '10295', name: 'Porsche 911 (포르쉐 911)', image: 'https://images.brickset.com/sets/images/10295-1.jpg', year: '2021' },
  { number: '10307', name: 'Eiffel Tower (에펠탑)', image: 'https://images.brickset.com/sets/images/10307-1.jpg', year: '2022' },
  { number: '10326', name: 'Natural History Museum (자연사 박물관)', image: 'https://images.brickset.com/sets/images/10326-1.jpg', year: '2023' },
  
  // Star Wars UCS & Popular
  { number: '75192', name: 'Millennium Falcon (밀레니엄 팔콘 UCS)', image: 'https://images.brickset.com/sets/images/75192-1.jpg', year: '2017' },
  { number: '75313', name: 'AT-AT (UCS)', image: 'https://images.brickset.com/sets/images/75313-1.jpg', year: '2021' },
  { number: '75331', name: 'The Razor Crest (레이저 크레스트 UCS)', image: 'https://images.brickset.com/sets/images/75331-1.jpg', year: '2022' },
  { number: '75341', name: 'Luke Skywalker\'s Landspeeder (랜드스피더 UCS)', image: 'https://images.brickset.com/sets/images/75341-1.jpg', year: '2022' },
  { number: '75252', name: 'Imperial Star Destroyer (스타 디스트로이어 UCS)', image: 'https://images.brickset.com/sets/images/75252-1.jpg', year: '2019' },
  { number: '75308', name: 'R2-D2', image: 'https://images.brickset.com/sets/images/75308-1.jpg', year: '2021' },
  { number: '75159', name: 'Death Star (데스 스타)', image: 'https://images.brickset.com/sets/images/75159-1.jpg', year: '2016' },
  { number: '75367', name: 'Venator-Class Republic Attack Cruiser (베나터급 리퍼블릭 어택 크루저)', image: 'https://images.brickset.com/sets/images/75367-1.jpg', year: '2023' },
  
  // Technic
  { number: '42115', name: 'Lamborghini Sián FKP 37 (람보르기니 시안)', image: 'https://images.brickset.com/sets/images/42115-1.jpg', year: '2020' },
  { number: '42143', name: 'Ferrari Daytona SP3 (페라리 데이토나)', image: 'https://images.brickset.com/sets/images/42143-1.jpg', year: '2022' },
  { number: '42083', name: 'Bugatti Chiron (부가티 시론)', image: 'https://images.brickset.com/sets/images/42083-1.jpg', year: '2018' },
  { number: '42110', name: 'Land Rover Defender (랜드로버 디펜더)', image: 'https://images.brickset.com/sets/images/42110-1.jpg', year: '2019' },
  { number: '42141', name: 'McLaren Formula 1 Race Car (맥라렌 F1 레이스카)', image: 'https://images.brickset.com/sets/images/42141-1.jpg', year: '2022' },
  
  // Ideas
  { number: '21322', name: 'Pirates of Barracuda Bay (바라쿠다 해적들)', image: 'https://images.brickset.com/sets/images/21322-1.jpg', year: '2020' },
  { number: '21323', name: 'Grand Piano (그랜드 피아노)', image: 'https://images.brickset.com/sets/images/21323-1.jpg', year: '2020' },
  { number: '21325', name: 'Medieval Blacksmith (중세 대장간)', image: 'https://images.brickset.com/sets/images/21325-1.jpg', year: '2021' },
  { number: '21327', name: 'Typewriter (타자기)', image: 'https://images.brickset.com/sets/images/21327-1.jpg', year: '2021' },
  { number: '21333', name: 'The Starry Night (별이 빛나는 밤)', image: 'https://images.brickset.com/sets/images/21333-1.jpg', year: '2022' },
  { number: '21341', name: 'Hocus Pocus: The Sanderson Sisters\' Cottage', image: 'https://images.brickset.com/sets/images/21341-1.jpg', year: '2023' },
  { number: '21348', name: 'Dungeons & Dragons: Red Dragon\'s Tale', image: 'https://images.brickset.com/sets/images/21348-1.jpg', year: '2024' },
  
  // Harry Potter
  { number: '71043', name: 'Hogwarts Castle (호그와트 성)', image: 'https://images.brickset.com/sets/images/71043-1.jpg', year: '2018' },
  { number: '75978', name: 'Diagon Alley (다이애건 앨리)', image: 'https://images.brickset.com/sets/images/75978-1.jpg', year: '2020' },
  { number: '76391', name: 'Hogwarts Icons Collectors\' Edition', image: 'https://images.brickset.com/sets/images/76391-1.jpg', year: '2021' },
  { number: '76405', name: 'Hogwarts Express - Collectors\' Edition', image: 'https://images.brickset.com/sets/images/76405-1.jpg', year: '2022' },
  { number: '76417', name: 'Gringotts Wizarding Bank (그린고트 은행)', image: 'https://images.brickset.com/sets/images/76417-1.jpg', year: '2023' },

  // Architecture
  { number: '21058', name: 'Great Pyramid of Giza (기자의 대피라미드)', image: 'https://images.brickset.com/sets/images/21058-1.jpg', year: '2022' },
  { number: '21056', name: 'Taj Mahal (타지마할)', image: 'https://images.brickset.com/sets/images/21056-1.jpg', year: '2021' },
  { number: '21042', name: 'Statue of Liberty (자유의 여신상)', image: 'https://images.brickset.com/sets/images/21042-1.jpg', year: '2018' },

  // Marvel
  { number: '76178', name: 'Daily Bugle (데일리 뷰글)', image: 'https://images.brickset.com/sets/images/76178-1.jpg', year: '2021' },
  { number: '76210', name: 'Hulkbuster (헐크버스터)', image: 'https://images.brickset.com/sets/images/76210-1.jpg', year: '2022' },
  { number: '76269', name: 'Avengers Tower (어벤져스 타워)', image: 'https://images.brickset.com/sets/images/76269-1.jpg', year: '2023' },

  // Classic / Historical
  { number: '10182', name: 'Cafe Corner (카페 코너)', image: 'https://images.brickset.com/sets/images/10182-1.jpg', year: '2007' },
  { number: '10185', name: 'Green Grocer (그린 그로서)', image: 'https://images.brickset.com/sets/images/10185-1.jpg', year: '2008' },
  { number: '10188', name: 'Death Star (데스 스타 2008)', image: 'https://images.brickset.com/sets/images/10188-1.jpg', year: '2008' },
  { number: '10189', name: 'Taj Mahal (타지마할 2008)', image: 'https://images.brickset.com/sets/images/10189-1.jpg', year: '2008' },
  { number: '10196', name: 'Grand Carousel (그랜드 회전목마)', image: 'https://images.brickset.com/sets/images/10196-1.jpg', year: '2009' },
  { number: '10210', name: 'Imperial Flagship (정부군 함선)', image: 'https://images.brickset.com/sets/images/10210-1.jpg', year: '2010' },
  { number: '10212', name: 'Imperial Shuttle (임페리얼 셔틀 UCS)', image: 'https://images.brickset.com/sets/images/10212-1.jpg', year: '2010' },
  { number: '10221', name: 'Super Star Destroyer (슈퍼 스타 디스트로이어)', image: 'https://images.brickset.com/sets/images/10221-1.jpg', year: '2011' },
];
