/* Airport coordinates + geo helpers for Tour stats (km flown, countries, etc.).
   Coordinates are approximate — great-circle distance tolerates small errors, so
   a fun "distance flown" figure stays within a couple of % of reality. Any code
   not in this table is skipped from the distance sum (and counted as unknown).
   IATA -> [lat, lng]. */
const AIRPORTS = {
  // United Kingdom & Ireland
  LHR:[51.4706,-0.4619], LGW:[51.1481,-0.1903], STN:[51.8850,0.2350], LTN:[51.8747,-0.3683],
  LCY:[51.5053,0.0553], MAN:[53.3537,-2.2750], BHX:[52.4539,-1.7480], EDI:[55.9500,-3.3725],
  GLA:[55.8719,-4.4331], BRS:[51.3827,-2.7191], NCL:[55.0375,-1.6917], LPL:[53.3336,-2.8497],
  LBA:[53.8659,-1.6606], BFS:[54.6575,-6.2158], EMA:[52.8311,-1.3281], ABZ:[57.2019,-2.1978],
  CWL:[51.3967,-3.3433], SOU:[50.9503,-1.3568], EXT:[50.7344,-3.4139], INV:[57.5425,-4.0475],
  DSA:[53.4805,-1.0106], SEN:[51.5714,0.6956], BOH:[50.7800,-1.8425], NQY:[50.4406,-4.9954],
  DUB:[53.4213,-6.2701], ORK:[51.8413,-8.4911], SNN:[52.7019,-8.9247],
  // Western Europe
  CDG:[49.0097,2.5479], ORY:[48.7233,2.3794], NCE:[43.6584,7.2159], LYS:[45.7256,5.0811],
  MRS:[43.4393,5.2214], TLS:[43.6293,1.3638], BOD:[44.8283,-0.7156], NTE:[47.1532,-1.6108],
  AMS:[52.3105,4.7683], BRU:[50.9014,4.4844], CRL:[50.4592,4.4538], LUX:[49.6266,6.2115],
  FRA:[50.0379,8.5622], MUC:[48.3538,11.7861], DUS:[51.2895,6.7668], CGN:[50.8659,7.1427],
  HAM:[53.6304,9.9882], BER:[52.3667,13.5033], STR:[48.6899,9.2219], HAJ:[52.4611,9.6851],
  NUE:[49.4987,11.0781], LEJ:[51.4239,12.2364], BRE:[53.0475,8.7867],
  ZRH:[47.4647,8.5492], GVA:[46.2381,6.1090], BSL:[47.5896,7.5299], VIE:[48.1103,16.5697],
  SZG:[47.7933,13.0043], INN:[47.2602,11.3439],
  // Italy
  MXP:[45.6306,8.7281], LIN:[45.4451,9.2767], BGY:[45.6739,9.7042], FCO:[41.8003,12.2389],
  CIA:[41.7994,12.5949], VCE:[45.5053,12.3519], NAP:[40.8860,14.2908], BLQ:[44.5354,11.2887],
  PSA:[43.6839,10.3927], FLR:[43.8100,11.2051], TRN:[45.2008,7.6496], BRI:[41.1389,16.7606],
  CTA:[37.4668,15.0664], PMO:[38.1759,13.0910], CAG:[39.2515,9.0543],
  // Iberia
  BCN:[41.2971,2.0785], MAD:[40.4936,-3.5668], AGP:[36.6749,-4.4991], PMI:[39.5517,2.7388],
  IBZ:[38.8729,1.3731], VLC:[39.4893,-0.4816], SVQ:[37.4180,-5.8931], BIO:[43.3011,-2.9106],
  ALC:[38.2822,-0.5582], GRX:[37.1889,-3.7773], SCQ:[42.8963,-8.4151], LPA:[27.9319,-15.3866],
  TFS:[28.0445,-16.5725], ACE:[28.9455,-13.6052], FUE:[28.4527,-13.8638],
  LIS:[38.7742,-9.1342], OPO:[41.2481,-8.6814], FAO:[37.0144,-7.9659], FNC:[32.6979,-16.7745],
  // Nordics & Baltics
  CPH:[55.6180,12.6508], ARN:[59.6519,17.9186], BMA:[59.3544,17.9417], GOT:[57.6685,12.2977],
  OSL:[60.1976,11.1004], BGO:[60.2934,5.2181], TRD:[63.4576,10.9240], HEL:[60.3172,24.9633],
  KEF:[63.9850,-22.6056], RIX:[56.9236,23.9711], TLL:[59.4133,24.8328], VNO:[54.6341,25.2858],
  // Central & Eastern Europe, Balkans, Greece
  PRG:[50.1008,14.2600], WAW:[52.1657,20.9671], KRK:[50.0777,19.7848], GDN:[54.3776,18.4662],
  WRO:[51.1027,16.8858], POZ:[52.4210,16.8263], BUD:[47.4369,19.2556], OTP:[44.5711,26.0850],
  SOF:[42.6967,23.4114], BEG:[44.8184,20.3091], ZAG:[45.7429,16.0688], LJU:[46.2237,14.4576],
  SPU:[43.5389,16.2980], DBV:[42.5614,18.2682], ZAD:[44.1083,15.3467], TIA:[41.4147,19.7206],
  ATH:[37.9364,23.9445], SKG:[40.5197,22.9709], JMK:[37.4351,25.3481], JTR:[36.3992,25.4793],
  HER:[35.3397,25.1803], RHO:[36.4054,28.0862], CFU:[39.6019,19.9117], CHQ:[35.5317,24.1497],
  // Turkey, Middle East
  IST:[41.2753,28.7519], SAW:[40.8986,29.3092], AYT:[36.8987,30.8005], ESB:[40.1281,32.9951],
  ADB:[38.2924,27.1570], DXB:[25.2532,55.3657], AUH:[24.4330,54.6511], DOH:[25.2731,51.6081],
  TLV:[32.0114,34.8867], RUH:[24.9576,46.6988], JED:[21.6796,39.1565], BAH:[26.2708,50.6336],
  KWI:[29.2266,47.9689], MCT:[23.5933,58.2844], AMM:[31.7226,35.9932], BEY:[33.8209,35.4884],
  // North America — USA
  JFK:[40.6413,-73.7781], LGA:[40.7769,-73.8740], EWR:[40.6895,-74.1745], BOS:[42.3656,-71.0096],
  PHL:[39.8744,-75.2424], IAD:[38.9531,-77.4565], DCA:[38.8512,-77.0402], BWI:[39.1774,-76.6684],
  ATL:[33.6407,-84.4277], MIA:[25.7959,-80.2870], FLL:[26.0742,-80.1506], MCO:[28.4312,-81.3081],
  TPA:[27.9755,-82.5332], ORD:[41.9742,-87.9073], MDW:[41.7868,-87.7522], DTW:[42.2124,-83.3534],
  MSP:[44.8848,-93.2223], DEN:[39.8561,-104.6737], LAS:[36.0840,-115.1537], LAX:[33.9416,-118.4085],
  SFO:[37.6213,-122.3790], SJC:[37.3639,-121.9289], OAK:[37.7126,-122.2197], SAN:[32.7338,-117.1933],
  SEA:[47.4502,-122.3088], PDX:[45.5898,-122.5951], PHX:[33.4342,-112.0116], DFW:[32.8998,-97.0403],
  IAH:[29.9902,-95.3368], AUS:[30.1975,-97.6664], MSY:[29.9934,-90.2580], BNA:[36.1263,-86.6774],
  CLT:[35.2140,-80.9431], RDU:[35.8776,-78.7875], SLC:[40.7899,-111.9791], HNL:[21.3187,-157.9224],
  // Canada
  YYZ:[43.6777,-79.6248], YUL:[45.4706,-73.7408], YVR:[49.1967,-123.1815], YYC:[51.1315,-114.0106],
  YOW:[45.3225,-75.6692], YEG:[53.3097,-113.5800], YWG:[49.9100,-97.2399], YHZ:[44.8808,-63.5086],
  // Latin America
  MEX:[19.4361,-99.0719], CUN:[21.0365,-86.8771], GDL:[20.5218,-103.3111], PVR:[20.6801,-105.2544],
  BOG:[4.7016,-74.1469], MDE:[6.1645,-75.4231], LIM:[-12.0219,-77.1143], SCL:[-33.3930,-70.7858],
  EZE:[-34.8222,-58.5358], AEP:[-34.5592,-58.4156], GIG:[-22.8100,-43.2506], GRU:[-23.4356,-46.4731],
  BSB:[-15.8711,-47.9186], MVD:[-34.8384,-56.0308], UIO:[-0.1292,-78.3575], PTY:[9.0714,-79.3835],
  SJO:[9.9939,-84.2088], HAV:[22.9892,-82.4091],
  // Asia
  NRT:[35.7720,140.3929], HND:[35.5494,139.7798], KIX:[34.4273,135.2440], NGO:[34.8584,136.8054],
  ICN:[37.4602,126.4407], GMP:[37.5586,126.7906], PEK:[40.0801,116.5846], PKX:[39.5098,116.4108],
  PVG:[31.1443,121.8083], SHA:[31.1979,121.3363], CAN:[23.3924,113.2988], SZX:[22.6393,113.8107],
  HKG:[22.3080,113.9185], TPE:[25.0777,121.2328], BKK:[13.6900,100.7501], DMK:[13.9126,100.6068],
  SIN:[1.3644,103.9915], KUL:[2.7456,101.7099], CGK:[-6.1256,106.6559], DPS:[-8.7482,115.1672],
  MNL:[14.5086,121.0198], SGN:[10.8188,106.6520], HAN:[21.2212,105.8072], DEL:[28.5562,77.1000],
  BOM:[19.0896,72.8656], BLR:[13.1979,77.7063], MAA:[12.9941,80.1709], HYD:[17.2403,78.4294],
  CMB:[7.1808,79.8841], KTM:[27.6966,85.3591],
  // Oceania
  SYD:[-33.9399,151.1753], MEL:[-37.6690,144.8410], BNE:[-27.3842,153.1175], PER:[-31.9385,115.9672],
  ADL:[-34.9450,138.5306], AKL:[-37.0082,174.7850], WLG:[-41.3272,174.8053], CHC:[-43.4894,172.5320],
  NAN:[-17.7554,177.4434],
  // Africa
  CMN:[33.3675,-7.5900], RAK:[31.6069,-8.0363], CAI:[30.1219,31.4056], CPT:[-33.9690,18.6021],
  JNB:[-26.1392,28.2460], DUR:[-29.6144,31.1197], LOS:[6.5774,3.3212], ABV:[9.0068,7.2632],
  NBO:[-1.3192,36.9278], ADD:[8.9779,38.7993], ACC:[5.6052,-0.1668], DAR:[-6.8781,39.2026],
  TUN:[36.8510,10.2272]
};

/* IATA -> ISO 3166-1 alpha-2 country, so a country can be inferred from a show's
   flights when the country field itself was left blank. */
const AIRPORT_CC = {
  LHR:'GB',LGW:'GB',STN:'GB',LTN:'GB',LCY:'GB',MAN:'GB',BHX:'GB',EDI:'GB',GLA:'GB',BRS:'GB',NCL:'GB',LPL:'GB',LBA:'GB',BFS:'GB',EMA:'GB',ABZ:'GB',CWL:'GB',SOU:'GB',EXT:'GB',INV:'GB',DSA:'GB',SEN:'GB',BOH:'GB',NQY:'GB',
  DUB:'IE',ORK:'IE',SNN:'IE',
  CDG:'FR',ORY:'FR',NCE:'FR',LYS:'FR',MRS:'FR',TLS:'FR',BOD:'FR',NTE:'FR',
  AMS:'NL',BRU:'BE',CRL:'BE',LUX:'LU',
  FRA:'DE',MUC:'DE',DUS:'DE',CGN:'DE',HAM:'DE',BER:'DE',STR:'DE',HAJ:'DE',NUE:'DE',LEJ:'DE',BRE:'DE',
  ZRH:'CH',GVA:'CH',BSL:'CH',VIE:'AT',SZG:'AT',INN:'AT',
  MXP:'IT',LIN:'IT',BGY:'IT',FCO:'IT',CIA:'IT',VCE:'IT',NAP:'IT',BLQ:'IT',PSA:'IT',FLR:'IT',TRN:'IT',BRI:'IT',CTA:'IT',PMO:'IT',CAG:'IT',
  BCN:'ES',MAD:'ES',AGP:'ES',PMI:'ES',IBZ:'ES',VLC:'ES',SVQ:'ES',BIO:'ES',ALC:'ES',GRX:'ES',SCQ:'ES',LPA:'ES',TFS:'ES',ACE:'ES',FUE:'ES',
  LIS:'PT',OPO:'PT',FAO:'PT',FNC:'PT',
  CPH:'DK',ARN:'SE',BMA:'SE',GOT:'SE',OSL:'NO',BGO:'NO',TRD:'NO',HEL:'FI',KEF:'IS',RIX:'LV',TLL:'EE',VNO:'LT',
  PRG:'CZ',WAW:'PL',KRK:'PL',GDN:'PL',WRO:'PL',POZ:'PL',BUD:'HU',OTP:'RO',SOF:'BG',BEG:'RS',ZAG:'HR',SPU:'HR',DBV:'HR',ZAD:'HR',LJU:'SI',TIA:'AL',
  ATH:'GR',SKG:'GR',JMK:'GR',JTR:'GR',HER:'GR',RHO:'GR',CFU:'GR',CHQ:'GR',
  IST:'TR',SAW:'TR',AYT:'TR',ESB:'TR',ADB:'TR',DXB:'AE',AUH:'AE',DOH:'QA',TLV:'IL',RUH:'SA',JED:'SA',BAH:'BH',KWI:'KW',MCT:'OM',AMM:'JO',BEY:'LB',
  JFK:'US',LGA:'US',EWR:'US',BOS:'US',PHL:'US',IAD:'US',DCA:'US',BWI:'US',ATL:'US',MIA:'US',FLL:'US',MCO:'US',TPA:'US',ORD:'US',MDW:'US',DTW:'US',MSP:'US',DEN:'US',LAS:'US',LAX:'US',SFO:'US',SJC:'US',OAK:'US',SAN:'US',SEA:'US',PDX:'US',PHX:'US',DFW:'US',IAH:'US',AUS:'US',MSY:'US',BNA:'US',CLT:'US',RDU:'US',SLC:'US',HNL:'US',
  YYZ:'CA',YUL:'CA',YVR:'CA',YYC:'CA',YOW:'CA',YEG:'CA',YWG:'CA',YHZ:'CA',
  MEX:'MX',CUN:'MX',GDL:'MX',PVR:'MX',BOG:'CO',MDE:'CO',LIM:'PE',SCL:'CL',EZE:'AR',AEP:'AR',GIG:'BR',GRU:'BR',BSB:'BR',MVD:'UY',UIO:'EC',PTY:'PA',SJO:'CR',HAV:'CU',
  NRT:'JP',HND:'JP',KIX:'JP',NGO:'JP',ICN:'KR',GMP:'KR',PEK:'CN',PKX:'CN',PVG:'CN',SHA:'CN',CAN:'CN',SZX:'CN',HKG:'HK',TPE:'TW',BKK:'TH',DMK:'TH',SIN:'SG',KUL:'MY',CGK:'ID',DPS:'ID',MNL:'PH',SGN:'VN',HAN:'VN',DEL:'IN',BOM:'IN',BLR:'IN',MAA:'IN',HYD:'IN',CMB:'LK',KTM:'NP',
  SYD:'AU',MEL:'AU',BNE:'AU',PER:'AU',ADL:'AU',AKL:'NZ',WLG:'NZ',CHC:'NZ',NAN:'FJ',
  CMN:'MA',RAK:'MA',CAI:'EG',CPT:'ZA',JNB:'ZA',DUR:'ZA',LOS:'NG',ABV:'NG',NBO:'KE',ADD:'ET',ACC:'GH',DAR:'TZ',TUN:'TN'
};
function airportLL(code){
  const c = (code||'').toString().trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? (AIRPORTS[c] || null) : null;
}
function airportCC(code){
  const c = (code||'').toString().trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? (AIRPORT_CC[c] || null) : null;
}
/* Great-circle distance in km between two [lat,lng] points (haversine). */
function haversineKm(a, b){
  if(!a || !b) return 0;
  const R = 6371, toR = x => x * Math.PI / 180;
  const dLat = toR(b[0]-a[0]), dLng = toR(b[1]-a[1]);
  const s = Math.sin(dLat/2)**2 + Math.cos(toR(a[0]))*Math.cos(toR(b[0]))*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}
/* Country name (free text) -> ISO 3166-1 alpha-2, for flag emoji. Covers the
   touring circuit; unknown names just get no flag. */
const COUNTRY_ISO = {
  'uk':'GB','u.k.':'GB','gb':'GB','england':'GB','scotland':'GB','wales':'GB','northern ireland':'GB',
  'great britain':'GB','united kingdom':'GB','britain':'GB',
  'ireland':'IE','republic of ireland':'IE',
  'france':'FR','spain':'ES','portugal':'PT','netherlands':'NL','holland':'NL','belgium':'BE',
  'luxembourg':'LU','germany':'DE','switzerland':'CH','austria':'AT','italy':'IT',
  'denmark':'DK','sweden':'SE','norway':'NO','finland':'FI','iceland':'IS','estonia':'EE',
  'latvia':'LV','lithuania':'LT','poland':'PL','czechia':'CZ','czech republic':'CZ','slovakia':'SK',
  'hungary':'HU','romania':'RO','bulgaria':'BG','serbia':'RS','croatia':'HR','slovenia':'SI',
  'greece':'GR','albania':'AL','north macedonia':'MK','montenegro':'ME','bosnia':'BA',
  'turkey':'TR','türkiye':'TR','cyprus':'CY','malta':'MT',
  'united states':'US','usa':'US','us':'US','u.s.':'US','america':'US','united states of america':'US',
  'canada':'CA','mexico':'MX','brazil':'BR','argentina':'AR','chile':'CL','colombia':'CO',
  'peru':'PE','uruguay':'UY','ecuador':'EC','panama':'PA','costa rica':'CR','cuba':'CU',
  'uae':'AE','united arab emirates':'AE','qatar':'QA','bahrain':'BH','kuwait':'KW','oman':'OM',
  'saudi arabia':'SA','israel':'IL','jordan':'JO','lebanon':'LB',
  'japan':'JP','south korea':'KR','korea':'KR','china':'CN','hong kong':'HK','taiwan':'TW',
  'thailand':'TH','singapore':'SG','malaysia':'MY','indonesia':'ID','philippines':'PH',
  'vietnam':'VN','india':'IN','sri lanka':'LK','nepal':'NP',
  'australia':'AU','new zealand':'NZ','fiji':'FJ',
  'morocco':'MA','egypt':'EG','south africa':'ZA','nigeria':'NG','kenya':'KE','ethiopia':'ET',
  'ghana':'GH','tanzania':'TZ','tunisia':'TN'
};
function countryISO(name){
  const k = (name||'').toString().trim().toLowerCase();
  return COUNTRY_ISO[k] || null;
}
function flagEmoji(iso2){
  if(!iso2 || iso2.length!==2) return '';
  return iso2.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)));
}
