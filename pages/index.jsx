import Head from 'next/head';
import { useEffect, useMemo, useRef, useState } from 'react';
import catalog from '../catalog/homes.json';
import { availableHomes } from '../catalog/inventory.js';

const HOUSE_PRICE = 8_000_000;
const HOUSE_AREA = 170;
const HOUSE_LAND = 5.5;
const MANAGER_PHONE = '8 923 425-68-36';
const MANAGER_PHONE_DIGITS = '79234256836';
const DGIS_STREET_URL = 'https://2gis.ru/tomsk/geo/70030076572497783';
const DGIS_MAP_KEY = process.env.NEXT_PUBLIC_DGIS_MAPGL_KEY || '';

const HOMES = availableHomes(catalog);
const HAS_HOMES = HOMES.length > 0;

const PROJECT_IMAGES = [
  { src: '/images/kazachya-sunset.webp', title: 'Казачья вечером', detail: 'Улица и построенные дома', layout: 'gallery-feature' },
  { src: '/images/duplex-facade.webp', title: 'Фасад дуплекса', detail: 'Кирпичный дом на Казачьей', layout: 'gallery-tall' },
  { src: '/images/kazachya-aerial.webp', title: 'Вид на улицу сверху', detail: 'Расположение домов на Казачьей', layout: 'gallery-wide' },
  { src: '/images/kitchen-living.webp', title: 'Пример обустройства', detail: 'Кухня и гостиная одного из домов', layout: 'gallery-wide' },
  { src: '/images/children-room.webp', title: 'Пример обустройства', detail: 'Детская комната одного из домов', layout: 'gallery-standard' },
  { src: '/images/staircase.webp', title: 'Внутри дома', detail: 'Лестница на второй этаж', layout: 'gallery-portrait' },
];

const INTERIOR_IDEAS = [
  { src: '/images/understairs-reading.webp', title: 'Читальный уголок', description: 'Мягкая посадка, светильник и полки: тихое место рядом с гостиной.', alt: 'Визуализация читального уголка с диваном и полками под лестницей' },
  { src: '/images/understairs-study.webp', title: 'Домашний кабинет', description: 'Стол и хранение там, где обычно остаётся свободная ниша.', alt: 'Визуализация рабочего места под лестницей' },
  { src: '/images/understairs-storage.webp', title: 'Встроенное хранение', description: 'Закрытые шкафы помогают сохранить простор в общей зоне.', alt: 'Визуализация встроенных шкафов и полок под лестницей' },
];

const LIVING_IDEAS = [
  { src: '/images/living-green.webp', title: 'Тёплый зелёный', description: 'Кухня-гостиная с мягким диваном, обеденным столом и шкафом у входа.', alt: 'Визуализация светлой кухни-гостиной с зелёными фасадами и уютной зоной отдыха' },
  { src: '/images/living-walnut.webp', title: 'Спокойный орех', description: 'Натуральные оттенки, большой стол и место для семейного вечера.', alt: 'Визуализация кухни-гостиной с мебелью орехового оттенка и обеденным столом' },
  { src: '/images/living-evening.webp', title: 'Вечер дома', description: 'Мягкий свет, диван и аккуратное хранение для инженерии.', alt: 'Визуализация кухни-гостиной в вечернем свете со встроенным шкафом' },
];

const AUTUMN_IMAGES = [
  { src: '/images/autumn-river-sunset.webp', title: 'Закат у воды', description: 'Вечерний свет и отражение неба.', alt: 'Осенний закат над водой с отражением облаков' },
  { src: '/images/autumn-neighborhood.webp', title: 'Осенний день', description: 'Дорога, дом и яркий лес.', alt: 'Дом и дорога на фоне осеннего леса в Заповедном' },
  { src: '/images/autumn-forest.webp', title: 'Цвета леса', description: 'Пейзаж рядом с домами.', alt: 'Осенний лес с жёлтыми, красными и зелёными деревьями' },
  { src: '/images/autumn-meadow.webp', title: 'Простор вокруг', description: 'Поле и лес на горизонте.', alt: 'Осеннее поле и лесистый склон под облачным небом' },
];

const formatNumber = (number) => new Intl.NumberFormat('ru-RU').format(Math.round(number));
const formatMillions = (price) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(price / 1_000_000);

function Icon({ name, size = 20, className = '' }) {
  const paths = {
    arrow: <path d="M7 17 17 7M8 7h9v9" />,
    down: <path d="m7 10 5 5 5-5" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    close: <path d="m18 6-12 12M6 6l12 12" />,
    check: <path d="m5 12 4 4L19 6" />,
    copy: <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
    house: <><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 21v-8h6v8" /></>,
    land: <><path d="M3 7h18M3 17h18M7 3v18M17 3v18" /><rect x="3" y="3" width="18" height="18" rx="2" /></>,
    layout: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M9 21V9" /></>,
    location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2" /></>,
    menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
    minus: <path d="M5 12h14" />,
    plus: <path d="M12 5v14m-7-7h14" />,
    phone: <><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" /></>,
    rooms: <><path d="M3 21V7l9-4 9 4v14" /><path d="M3 11h18M9 21v-6h6v6" /></>,
    spark: <path d="m12 3 1.9 5.8L20 11l-6.1 2.1L12 19l-1.9-5.9L4 11l6.1-2.2L12 3Z" />,
  };

  return (
    <svg aria-hidden="true" className={className} fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6" viewBox="0 0 24 24" width={size}>
      {paths[name]}
    </svg>
  );
}

function Logo({ light = false }) {
  return (
    <a aria-label="Заповедный — на главную" className={`brand ${light ? 'brand-light' : ''}`} href="#home">
      <span className="brand-mark" aria-hidden="true"><span /><span /><span /></span>
      <span className="brand-wordmark">ЗАПОВЕДНЫЙ<span>МЕСТО ДЛЯ ЖИЗНИ</span></span>
    </a>
  );
}

function Header({ openLead }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 35);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return (
    <header className={`header ${scrolled ? 'header-scrolled' : ''}`}>
      <div className="header-inner">
        <Logo light={!scrolled} />
        <nav aria-label="Навигация по сайту" className={`navigation ${menuOpen ? 'navigation-open' : ''}`}>
          <a href="#map" onClick={() => setMenuOpen(false)}>Дома на карте</a>
          <a href="#plans" onClick={() => setMenuOpen(false)}>Планировка</a>
          <a href="#gallery" onClick={() => setMenuOpen(false)}>Фото</a>
          <a href="#compare" onClick={() => setMenuOpen(false)}>Сравнить адреса</a>
        </nav>
        <button className="header-cta" onClick={openLead}>{HAS_HOMES ? 'Записаться на просмотр' : 'Узнать о новых домах'} <Icon name="arrow" size={15} /></button>
        <button aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'} className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? 'close' : 'menu'} /></button>
      </div>
    </header>
  );
}

function Hero({ openLead }) {
  return (
    <section className="hero" id="home">
      <div className="hero-image" role="img" aria-label="Панорама улицы Казачьей и дуплексов посёлка «Заповедный»" />
      <div className="hero-overlay" />
      <div className="hero-content shell">
        <div className="eyebrow hero-eyebrow">Коларово · микрорайон «Заповедный»</div>
        <h1>{HAS_HOMES ? <>Свой дом уже<br /><em>ждёт вас.</em></> : <>Новая очередь<br /><em>готовится.</em></>}</h1>
        <p className="hero-description">{HAS_HOMES ? 'Готовый кирпичный дуплекс на улице Казачьей: около 170 м², участок от 5,5 соток. Специальная цена — 8 млн ₽. Приезжайте посмотреть дом, улицу и планировку своими глазами.' : 'Следующие дома на улице Казачьей готовятся к продаже. Оставьте контакт, чтобы узнать о новых адресах и сроках просмотра.'}</p>
        <div className="hero-actions"><button className="button button-light" onClick={openLead}>{HAS_HOMES ? 'Записаться на просмотр' : 'Узнать о новых домах'} <Icon name="arrow" size={17} /></button><a className="button hero-call-button" href={`tel:+${MANAGER_PHONE_DIGITS}`}><Icon name="phone" size={17} /> Позвонить</a><a className="text-link" href="#map">{HAS_HOMES ? 'Выбрать адрес' : 'Посмотреть улицу'} <Icon name="down" size={16} /></a></div>
      </div>
      <div className="hero-bottom shell">
        {HAS_HOMES && <div className="hero-metrics">
          <div><strong>≈ 170 м²</strong><span>площадь дома</span></div>
          <div><strong>от 5,5 соток</strong><span>участок</span></div>
          <div><strong>3 спальни</strong><span>на втором этаже</span></div>
          <div><strong>8 млн ₽</strong><span>специальная цена*</span></div>
        </div>}
        <span className="image-note">Фото улицы Казачьей{HAS_HOMES ? ' · *условия уточняйте при обращении' : ''}</span>
      </div>
      <a aria-label="Перейти к схеме посёлка" className="hero-scroll" href="#map"><Icon name="down" /></a>
    </section>
  );
}

function InteractiveMap({ activeHome, setActiveHome }) {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [mapState, setMapState] = useState(DGIS_MAP_KEY ? 'loading' : 'needs-key');
  const [mapView, setMapView] = useState('scheme');
  const [mapZoom, setMapZoom] = useState(1);

  useEffect(() => {
    if (!DGIS_MAP_KEY || !mapContainerRef.current) return undefined;
    let cancelled = false;

    const startMap = () => {
      if (cancelled || !window.mapgl || mapRef.current) return;
      try {
        mapRef.current = new window.mapgl.Map(mapContainerRef.current, {
          key: DGIS_MAP_KEY,
          center: [84.953064, 56.340341],
          zoom: 17.4,
          zoomControl: 'bottomRight',
          scaleControl: 'bottomLeft',
          copyright: 'bottomLeft',
          enableTrackResize: true,
        });
        setMapState('ready');
      } catch {
        setMapState('error');
      }
    };

    if (window.mapgl) {
      startMap();
    } else {
      const existing = document.getElementById('dgis-mapgl-script');
      if (existing) {
        existing.addEventListener('load', startMap, { once: true });
      } else {
        const script = document.createElement('script');
        script.id = 'dgis-mapgl-script';
        script.src = 'https://mapgl.2gis.com/api/js/v1';
        script.async = true;
        script.onload = startMap;
        script.onerror = () => setMapState('error');
        document.head.appendChild(script);
      }
    }

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, []);

  const selectMapView = (view) => {
    setMapView(view);
    setMapZoom(1);
  };

  const isSatellite = mapView === 'satellite';

  return (
    <div className="map-canvas">
      <div className="map-label"><Icon name="location" size={15} /><span>{isSatellite && mapState !== 'ready' ? 'Спутник · улица Казачья' : '2ГИС · улица Казачья'}</span></div>
      <div aria-label="Интерактивная карта 2ГИС улицы Казачьей" className="dgis-map" ref={mapContainerRef} />
      {mapState !== 'ready' && (
        <div className={`map-preview ${isSatellite ? 'map-preview-satellite' : 'map-preview-scheme'}`}>
          <img
            alt={isSatellite ? 'Спутниковый снимок улицы Казачьей и расположения дуплексов' : 'Схема улицы Казачьей в 2ГИС с номерами домов'}
            className="map-preview-image"
            decoding="async"
            src={isSatellite ? '/images/kazachya-satellite-map.webp' : '/images/kazachya-2gis-map.webp'}
            style={{ transform: `scale(${mapZoom})` }}
          />
          <div aria-label="Вид карты" className="map-view-switch" role="group">
            <button aria-pressed={!isSatellite} className={!isSatellite ? 'is-active' : ''} onClick={() => selectMapView('scheme')} type="button">2ГИС</button>
            <button aria-pressed={isSatellite} className={isSatellite ? 'is-active' : ''} onClick={() => selectMapView('satellite')} type="button">Спутник</button>
          </div>
          <a aria-label="Открыть интерактивную карту улицы Казачьей в 2ГИС" className="map-open-link" href={DGIS_STREET_URL} rel="noreferrer" target="_blank">Открыть в 2ГИС <Icon name="arrow" size={14} /></a>
          <div aria-label="Масштаб снимка" className="map-zoom-controls" role="group">
            <button aria-label="Увеличить карту" disabled={mapZoom >= 1.54} onClick={() => setMapZoom((zoom) => Math.min(1.54, Number((zoom + 0.18).toFixed(2))))} type="button"><Icon name="plus" size={17} /></button>
            <button aria-label="Уменьшить карту" disabled={mapZoom <= 1} onClick={() => setMapZoom((zoom) => Math.max(1, Number((zoom - 0.18).toFixed(2))))} type="button"><Icon name="minus" size={17} /></button>
          </div>
        </div>
      )}
      <div className="map-addresses" aria-label="Дома в продаже на улице Казачьей">{HOMES.length ? HOMES.map((home) => <button aria-label={`Выбрать дом ${home.id}`} aria-pressed={home.id === activeHome} className={home.id === activeHome ? 'is-active' : ''} key={home.id} onClick={() => setActiveHome(home.id)}>{home.id}</button>) : <span>Новых адресов в продаже пока нет</span>}</div>
      <div className="map-disclaimer">Карта показывает улицу целиком · в продаже только адреса ниже</div>
    </div>
  );
}

function HouseCard({ activeHome, openLead }) {
  const home = HOMES.find((item) => item.id === activeHome);
  if (!home) return <aside className="house-card empty-house-card"><span className="eyebrow section-kicker">АДРЕСА НА КАЗАЧЬЕЙ</span><h3>Скоро появятся новые дома.</h3><p>Оставьте номер или позвоните нам, чтобы узнать о следующем этапе продаж.</p><button className="button button-forest house-button" onClick={() => openLead([])}>Узнать о новых домах <Icon name="arrow" size={16} /></button><a className="house-call-button" href={`tel:+${MANAGER_PHONE_DIGITS}`}><Icon name="phone" size={16} />Позвонить: {MANAGER_PHONE}</a></aside>;
  const isExtraRoom = home.layout === 'extra-room';
  const isStandard = home.layout === 'standard';

  return (
    <aside className="house-card">
      <div className="house-card-top"><span>ВЫБРАННЫЙ АДРЕС</span><span className="sale-status">В ПРОДАЖЕ</span></div>
      <div className="house-photo"><span>ФОТО ДОМА НА КАЗАЧЬЕЙ</span></div>
      <h3>{home.name}</h3>
      <p className="house-location"><Icon name="location" size={15} />с. Коларово · микрорайон «Заповедный»</p>
      <p className="address-note">Фото показывает тип дома, а не выбранный адрес. Перед поездкой подтвердим наличие и условия.</p>
      <div className="house-layout"><strong>{isExtraRoom ? 'Отдельная комната на первом этаже' : isStandard ? 'Стандартная планировка' : 'Планировка по запросу'}</strong><p>{isExtraRoom ? 'Кухня-гостиная разделена перегородкой: отдельный вход в кухню и отдельный — в четвёртую комнату. Она подойдёт для кабинета или гостей.' : isStandard ? 'Внизу кухня-гостиная, прихожая и санузел. Наверху три спальни: две детские и родительская с балконом, а также второй санузел.' : 'По этому адресу уточним расположение комнат и покажем дом на просмотре.'}</p></div>
      <div className="house-specs address-specs"><div><Icon name="house" /><strong>≈ 170 м²</strong><span>дом</span></div><div><Icon name="land" /><strong>от 5,5</strong><span>сотки</span></div><div><Icon name="rooms" /><strong>2 этажа</strong><span>{isExtraRoom ? '3 спальни + комната' : isStandard ? '3 спальни' : 'план уточнить'}</span></div></div>
      <div className="house-price"><span>Цена выбранного адреса</span><strong>Уточнить</strong></div>
      <button className="button button-forest house-button" onClick={() => openLead([activeHome])}>Уточнить и посмотреть <Icon name="arrow" size={16} /></button>
      <a className="house-call-button" href={`tel:+${MANAGER_PHONE_DIGITS}`}><Icon name="phone" size={16} /><span>Позвонить</span><strong>{MANAGER_PHONE}</strong></a>
      <a className="house-map-link" href={home.mapUrl} rel="noreferrer" target="_blank">Посмотреть адрес в 2ГИС <Icon name="arrow" size={14} /></a>
    </aside>
  );
}

function Comparison({ activeHome, setActiveHome, openLead }) {
  const [selectedSecondHomeId, setSecondHomeId] = useState(HOMES.find((home) => home.id !== activeHome)?.id ?? null);
  const secondHomeId = selectedSecondHomeId !== activeHome && HOMES.some((home) => home.id === selectedSecondHomeId) ? selectedSecondHomeId : HOMES.find((home) => home.id !== activeHome)?.id;
  if (HOMES.length < 2) return <div className="comparison" id="compare"><div className="comparison-heading"><div><span className="eyebrow section-kicker">04 / ДВА АДРЕСА</span><h3>Сравните<br /><em>на месте.</em></h3></div><p>Сравнение появится, когда в продаже будут как минимум два дома.</p></div></div>;
  const firstHome = HOMES.find((home) => home.id === activeHome);
  const secondHome = HOMES.find((home) => home.id === secondHomeId);
  const layoutLabel = (home) => home.layout === 'extra-room' ? 'Кухня и доп. комната' : home.layout === 'standard' ? 'Кухня-гостиная' : 'Уточнить планировку';
  const roomsLabel = (home) => home.layout === 'extra-room' ? '3 спальни + комната внизу' : home.layout === 'standard' ? '3 спальни наверху' : 'Уточнить';
  const details = [['Адрес', firstHome.name, secondHome.name], ['Первый этаж', layoutLabel(firstHome), layoutLabel(secondHome)], ['Комнаты', roomsLabel(firstHome), roomsLabel(secondHome)], ['Площадь участка', 'Запросить', 'Запросить'], ['Отделка и готовность', 'Проверить на показе', 'Проверить на показе'], ['Актуальный статус', 'В продаже', 'В продаже']];

  return (
    <div className="comparison" id="compare">
      <div className="comparison-heading"><div><span className="eyebrow section-kicker">04 / ДВА АДРЕСА</span><h3>Сравните<br /><em>на месте.</em></h3></div><p>Выберите два адреса, посмотрите их на карте. Мы подготовим данные по участкам и покажем оба дома за один визит.</p></div>
      <div className="compare-selectors"><label>Первый дом<select aria-label="Первый дом для сравнения" onChange={(event) => setActiveHome(event.target.value)} value={activeHome}>{HOMES.map((home) => <option key={home.id} value={home.id}>{home.name}</option>)}</select></label><label>Второй дом<select aria-label="Второй дом для сравнения" onChange={(event) => setSecondHomeId(event.target.value)} value={secondHomeId}>{HOMES.filter((home) => home.id !== activeHome).map((home) => <option key={home.id} value={home.id}>{home.name}</option>)}</select></label></div>
      <div className="comparison-table" role="table" aria-label="Сравнение выбранных домов">
        <div className="comparison-row comparison-header" role="row"><span role="columnheader">Характеристики</span><a href={firstHome.mapUrl} rel="noreferrer" role="columnheader" target="_blank">{firstHome.name} <Icon name="arrow" size={14} /></a><a href={secondHome.mapUrl} rel="noreferrer" role="columnheader" target="_blank">{secondHome.name} <Icon name="arrow" size={14} /></a></div>
        {details.map(([label, first, second]) => <div className={`comparison-row ${label === 'Стоимость' ? 'comparison-price-row' : ''}`} key={label} role="row"><span role="cell">{label}</span><strong role="cell">{first}</strong><strong role="cell">{second}</strong></div>)}
      </div>
      <button className="comparison-link" onClick={() => openLead([activeHome, secondHomeId])}>Записаться на просмотр этих адресов <Icon name="arrow" size={16} /></button>
    </div>
  );
}

function ProjectGallery({ openLead }) {
  const [activeIndex, setActiveIndex] = useState(null);

  useEffect(() => {
    if (activeIndex === null) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') setActiveIndex(null);
      if (event.key === 'ArrowRight') setActiveIndex((index) => (index + 1) % PROJECT_IMAGES.length);
      if (event.key === 'ArrowLeft') setActiveIndex((index) => (index - 1 + PROJECT_IMAGES.length) % PROJECT_IMAGES.length);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [activeIndex]);

  const activeImage = activeIndex === null ? null : PROJECT_IMAGES[activeIndex];
  const showPrevious = () => setActiveIndex((index) => (index - 1 + PROJECT_IMAGES.length) % PROJECT_IMAGES.length);
  const showNext = () => setActiveIndex((index) => (index + 1) % PROJECT_IMAGES.length);

  return (
    <div className="project-gallery" id="gallery">
      <div className="gallery-heading">
        <div><span className="eyebrow section-kicker">03 / КАЗАЧЬЯ В ДЕТАЛЯХ</span><h3>Посмотрите<br /><em>сами.</em></h3></div>
        <p>Настоящие фото улицы, фасада и помещений. По ним проще решить, стоит ли приезжать на показ.</p>
      </div>
      <div aria-label="Изображения домов и улицы Казачьей" className="gallery-grid">
        {PROJECT_IMAGES.map((image, index) => (
          <button aria-label={`Открыть изображение: ${image.title}`} className={`gallery-item ${image.layout}`} key={image.src} onClick={() => setActiveIndex(index)} type="button">
            <img alt={image.detail} decoding="async" loading="lazy" src={image.src} />
            <span className="gallery-item-label"><strong>{image.title}</strong><span>{image.detail}</span></span>
            <span aria-hidden="true" className="gallery-expand"><Icon name="arrow" size={16} /></span>
          </button>
        ))}
      </div>
      <div className="gallery-footer"><span>Интерьеры показывают пример обустройства. Дома предлагаются в черновой отделке; комплектацию уточняйте для выбранного адреса.</span><button onClick={openLead} type="button">Посмотреть дом лично <Icon name="arrow" size={16} /></button></div>
      {activeImage && <div className="gallery-lightbox" onClick={(event) => { if (event.target === event.currentTarget) setActiveIndex(null); }}><div aria-label="Просмотр изображений проекта" aria-modal="true" className="gallery-dialog" role="dialog"><button aria-label="Закрыть изображение" className="gallery-close" onClick={() => setActiveIndex(null)} type="button"><Icon name="close" size={22} /></button><button aria-label="Предыдущее изображение" className="gallery-arrow gallery-arrow-previous" onClick={showPrevious} type="button"><Icon name="chevron" size={25} /></button><img alt={activeImage.detail} className="gallery-dialog-image" src={activeImage.src} /><button aria-label="Следующее изображение" className="gallery-arrow gallery-arrow-next" onClick={showNext} type="button"><Icon name="chevron" size={25} /></button><div className="gallery-caption"><span><strong>{activeImage.title}</strong><span>{activeImage.detail}</span></span><span>{String(activeIndex + 1).padStart(2, '0')} / {String(PROJECT_IMAGES.length).padStart(2, '0')}</span></div></div></div>}
    </div>
  );
}

function HomeFacts({ openLead }) {
  return <section className="facts-section"><div className="shell facts-grid">
    <div className="facts-intro"><span className="eyebrow section-kicker">{HAS_HOMES ? 'ГОТОВЫЙ ДОМ' : 'СЛЕДУЮЩАЯ ОЧЕРЕДЬ'}</span><h2>{HAS_HOMES ? 'Уже построен.' : 'Будьте в курсе.'}</h2><p>{HAS_HOMES ? 'Можно приехать на Казачью, пройти по комнатам, посмотреть участок и задать вопросы по конкретному дому.' : 'Оставьте контакт, и мы расскажем, когда появятся новые адреса и можно будет приехать на просмотр.'}</p><button className="facts-cta" onClick={openLead}>{HAS_HOMES ? 'Договориться о показе' : 'Узнать о новых домах'} <Icon name="arrow" size={17} /></button></div>
    <div className="facts-list">
      <div><strong>01</strong><span><b>Место для семьи</b>Два этажа, три спальни, кухня-гостиная и два санузла.</span></div>
      <div><strong>02</strong><span><b>Участок и автомобиль</b>Участок от 5,5 соток и навес на две машины.</span></div>
      <div><strong>03</strong><span><b>Инженерия</b>Магистральный газ, центральный водопровод, 15 кВт электричества и септик.</span></div>
      <div><strong>04</strong><span><b>Рядом с Томском</b>Коларово, примерно 15 минут на машине от площади Южной без учёта пробок.</span></div>
    </div>
  </div></section>;
}

function PlansSection({ openLead }) {
  return <section className="plans-section" id="plans"><div className="shell">
    <div className="plans-heading"><div><span className="eyebrow section-kicker">02 / ПЛАНИРОВКА</span><h2>Посмотрите, как<br /><em>устроен дом.</em></h2></div><p>На планах — стандартный вариант дуплекса. У некоторых домов на первом этаже есть дополнительная комната. Отличия по выбранному адресу покажем на просмотре.</p></div>
    <div className="plans-grid"><figure><img alt="План первого этажа левой половины дуплекса: навес, кухня-гостиная, лестница и санузел" loading="lazy" src="/images/plan-first-floor.jpg" /><figcaption><strong>Первый этаж</strong><span>Кухня-гостиная · санузел · выход во двор · навес</span></figcaption></figure><figure><img alt="План второго этажа левой половины дуплекса: три спальни и санузел" loading="lazy" src="/images/plan-second-floor.jpg" /><figcaption><strong>Второй этаж</strong><span>Три спальни · санузел</span></figcaption></figure></div>
    <div className="plans-footer"><span>На изображениях показана левая половина стандартного дуплекса и пример расстановки мебели. Планировку выбранного дома уточним отдельно. Дома передаются в черновой отделке.</span><button onClick={openLead}>Посмотреть планировку вживую <Icon name="arrow" size={16} /></button></div>
  </div></section>;
}

function InteriorIdeas({ openLead }) {
  return <section aria-labelledby="interior-title" className="interior-ideas" id="ideas">
    <div className="interior-heading"><div><span className="eyebrow section-kicker">ИДЕИ ДЛЯ ДОМА</span><h3 id="interior-title">Место под лестницей<br /><em>может стать вашим.</em></h3></div><p>Планировка оставляет пространство для разных сценариев жизни. Вот три идеи, как его обустроить.</p></div>
    <div className="interior-grid">{INTERIOR_IDEAS.map((idea) => <figure className="interior-card" key={idea.src}><div className="interior-image"><img alt={idea.alt} decoding="async" loading="lazy" src={idea.src} /><span>Визуализация</span></div><figcaption><h4>{idea.title}</h4><p>{idea.description}</p></figcaption></figure>)}</div>
    <div className="interior-footer"><p>Это концепции обустройства, а не фотографии готовых домов. Дома передаются в черновой отделке; мебель и отделка на визуализациях в стоимость не входят. Возможность реализации уточните для выбранного дома.</p><button onClick={openLead} type="button">Обсудить на просмотре <Icon name="arrow" size={16} /></button></div>
  </section>;
}

function VisualLightbox({ images, activeIndex, close, setActiveIndex, label }) {
  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') close();
      if (event.key === 'ArrowRight') setActiveIndex((index) => (index + 1) % images.length);
      if (event.key === 'ArrowLeft') setActiveIndex((index) => (index - 1 + images.length) % images.length);
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [close, images, setActiveIndex]);

  const current = images[activeIndex];
  return <div className="gallery-lightbox" onClick={(event) => { if (event.target === event.currentTarget) close(); }}><div aria-label={label} aria-modal="true" className="gallery-dialog" role="dialog"><button aria-label="Закрыть изображение" className="gallery-close" onClick={close} type="button"><Icon name="close" size={22} /></button><button aria-label="Предыдущее изображение" className="gallery-arrow gallery-arrow-previous" onClick={() => setActiveIndex((index) => (index - 1 + images.length) % images.length)} type="button"><Icon name="chevron" size={25} /></button><img alt={current.alt} className="gallery-dialog-image" src={current.src} /><button aria-label="Следующее изображение" className="gallery-arrow gallery-arrow-next" onClick={() => setActiveIndex((index) => (index + 1) % images.length)} type="button"><Icon name="chevron" size={25} /></button><div className="gallery-caption"><span><strong>{current.title}</strong><span>{current.description}</span></span><span>{String(activeIndex + 1).padStart(2, '0')} / {String(images.length).padStart(2, '0')}</span></div></div></div>;
}

function LivingIdeas({ openLead }) {
  const [activeIndex, setActiveIndex] = useState(null);
  return <section aria-labelledby="living-title" className="living-ideas" id="living">
    <div className="living-heading"><div><span className="eyebrow section-kicker">ИДЕИ ДЛЯ ДОМА</span><h3 id="living-title">Кухня-гостиная,<br /><em>в которую хочется вернуться.</em></h3></div><p>Три настроения для одной общей зоны: свет, фактуры, большой стол и место, где собирается семья.</p></div>
    <div className="living-grid">{LIVING_IDEAS.map((idea, index) => <button aria-label={`Открыть визуализацию: ${idea.title}`} className="living-card" key={idea.src} onClick={() => setActiveIndex(index)} type="button"><img alt={idea.alt} decoding="async" loading="lazy" src={idea.src} /><span className="living-caption"><small>Визуализация интерьера</small><strong>{idea.title}</strong><span>{idea.description}</span></span><span aria-hidden="true" className="living-expand"><Icon name="arrow" size={17} /></span></button>)}</div>
    <div className="living-footer"><span>Это варианты обустройства. Дома передаются в черновой отделке; мебель и отделка на визуализациях в стоимость не входят.</span><button onClick={openLead} type="button">Посмотреть помещение вживую <Icon name="arrow" size={16} /></button></div>
    {activeIndex !== null && <VisualLightbox activeIndex={activeIndex} close={() => setActiveIndex(null)} images={LIVING_IDEAS} label="Варианты кухни-гостиной" setActiveIndex={setActiveIndex} />}
  </section>;
}

function AutumnGallery({ openLead }) {
  const [activeIndex, setActiveIndex] = useState(null);
  return <section aria-labelledby="autumn-title" className="autumn-section" id="autumn">
    <div className="autumn-heading"><div><span className="eyebrow section-kicker">МЕСТО ДЛЯ ЖИЗНИ</span><h3 id="autumn-title">Осень в <em>Заповедном.</em></h3></div><p>Дом начинается за порогом. Сохранили несколько осенних кадров, чтобы вы почувствовали настроение этого места.</p></div>
    <div aria-label="Осенние фотографии Заповедного" className="autumn-grid">{AUTUMN_IMAGES.map((photo, index) => <button aria-label={`Открыть фото: ${photo.title}`} className="autumn-card" key={photo.src} onClick={() => setActiveIndex(index)} type="button"><img alt={photo.alt} decoding="async" loading="lazy" src={photo.src} /><span>{photo.title}</span><span aria-hidden="true" className="gallery-expand"><Icon name="arrow" size={16} /></span></button>)}</div>
    <div className="autumn-footer"><span>Осенние виды, присланные командой проекта.</span><button onClick={openLead} type="button">Приехать и увидеть самому <Icon name="arrow" size={16} /></button></div>
    {activeIndex !== null && <VisualLightbox activeIndex={activeIndex} close={() => setActiveIndex(null)} images={AUTUMN_IMAGES} label="Осенние фотографии Заповедного" setActiveIndex={setActiveIndex} />}
  </section>;
}

function HomesSection({ activeHome, setActiveHome, openLead }) {
  return (
    <section className="homes-section" id="map">
      <div className="shell">
        <div className="section-heading"><span className="eyebrow section-kicker">01 / УЛИЦА КАЗАЧЬЯ</span><h2>{HAS_HOMES ? <>Выберите адрес<br /><em>на карте.</em></> : <>Узнайте о новой<br /><em>очереди домов.</em></>}</h2><p>{HAS_HOMES ? `Сейчас в продаже ${HOMES.length} ${HOMES.length % 10 === 1 && HOMES.length % 100 !== 11 ? 'дом' : [2, 3, 4].includes(HOMES.length % 10) && ![12, 13, 14].includes(HOMES.length % 100) ? 'дома' : 'домов'} на Казачьей. Выберите номер, посмотрите адрес в 2ГИС и запишитесь на просмотр. Наличие подтвердим перед поездкой.` : 'Сейчас свободных домов в открытой продаже нет. Оставьте контакты, и мы сообщим о новых адресах.'}</p></div>
        <div className="map-grid"><InteractiveMap activeHome={activeHome} setActiveHome={setActiveHome} /><HouseCard activeHome={activeHome} openLead={openLead} /></div>
        <PlansSection openLead={openLead} />
        <LivingIdeas openLead={openLead} />
        <InteriorIdeas openLead={openLead} />
        <ProjectGallery openLead={openLead} />
        <AutumnGallery openLead={openLead} />
        <Comparison activeHome={activeHome} openLead={openLead} setActiveHome={setActiveHome} />
      </div>
    </section>
  );
}

function RangeControl({ label, value, min, max, step, onChange, display }) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <label className="range-control"><span>{label}</span><strong>{display}</strong><input aria-label={label} max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} step={step} style={{ '--range-progress': `${percentage}%` }} type="range" value={value} /><div className="range-boundaries"><span>{min === 3_000_000 ? '3 млн ₽' : `${min} м²`}</span><span>{max === 18_000_000 ? '18 млн ₽' : `${max} м²`}</span></div></label>
  );
}

function Calculator({ openLead }) {
  const [apartmentArea, setApartmentArea] = useState(47);
  const [apartmentPrice, setApartmentPrice] = useState(8_000_000);
  const housePerMeter = HOUSE_PRICE / HOUSE_AREA;
  const apartmentPerMeter = apartmentPrice / apartmentArea;
  const extraArea = HOUSE_AREA - apartmentArea;
  const meterDifference = Math.round((1 - housePerMeter / apartmentPerMeter) * 100);

  return (
    <section className="calculator-section" id="calculator"><div className="shell calculator-shell">
      <div className="calculator-heading"><span className="eyebrow calculator-kicker">05 / ПОСЧИТАЙТЕ САМИ</span><h2>Квартира<br /><em>или дом?</em></h2><p>Для примера — квартира 47 м² за 8 млн ₽. Передвиньте ползунки и подставьте площадь и цену своего варианта.</p></div>
      <div className="calculator-layout"><div className="calculator-inputs"><div className="inputs-title"><Icon name="house" size={20} /><span>Параметры городской квартиры</span></div><RangeControl display={`${apartmentArea} м²`} label="Площадь квартиры" max={150} min={35} onChange={setApartmentArea} step={1} value={apartmentArea} /><RangeControl display={`${formatMillions(apartmentPrice)} млн ₽`} label="Стоимость квартиры" max={18_000_000} min={3_000_000} onChange={setApartmentPrice} step={100_000} value={apartmentPrice} /><div className="fixed-house"><span>Дуплекс в «Заповедном»</span><strong>170 м² · 8 млн ₽</strong></div></div>
        <div aria-live="polite" className="calculator-results"><span className="results-label">РАЗНИЦА В ПЛОЩАДИ</span><div className="main-result"><strong>+{extraArea}</strong><span>м² в доме по сравнению<br />с выбранной квартирой</span></div><div className="result-rule" /><div className="result-metrics"><div><span>Дуплекс</span><strong>{formatNumber(housePerMeter)} ₽/м²</strong></div><div><span>Квартира</span><strong>{formatNumber(apartmentPerMeter)} ₽/м²</strong></div></div><div className="result-summary"><Icon name="spark" size={18} /><span>{meterDifference > 0 ? `Расчётная цена 1 м² дома ниже на ${meterDifference}%` : 'Сравните также участок, условия и расходы на отделку'}</span></div><div className="land-bonus"><Icon name="land" size={17} /><span>К дому — <strong>участок от {String(HOUSE_LAND).replace('.', ',')} соток</strong></span></div></div>
      </div>
      <div className="calculator-footer"><span>Это сравнение только цены и площади. В нём не учтены расположение, участок, отделка и расходы на содержание. Условия покупки уточняйте у менеджера.</span><button className="button button-light calculator-button" onClick={openLead}>Посмотреть дом своими глазами <Icon name="arrow" size={16} /></button></div>
    </div></section>
  );
}

function Footer() {
  return <footer className="footer"><div className="shell footer-inner"><Logo /><span>Заповедный — место для жизни.</span><span>Томская область · {new Date().getFullYear()}</span></div></footer>;
}

function LeadModal({ selectedHomes, close }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredChannel, setPreferredChannel] = useState('');
  const [messengerHandle, setMessengerHandle] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState('idle');
  const addresses = useMemo(() => [...new Set(selectedHomes)], [selectedHomes]);
  const addressText = addresses.map((home) => `Казачья, ${home}`).join(' и ');
  const message = `Здравствуйте! Пишу с сайта «Заповедного». Хочу посмотреть ${addresses.length > 1 ? `дома по адресам ${addressText}` : addresses.length ? `дом по адресу ${addressText}` : 'дома на улице Казачьей'}. Подскажите, какие варианты сейчас доступны и когда можно приехать?`;
  const whatsappUrl = `https://wa.me/${MANAGER_PHONE_DIGITS}?text=${encodeURIComponent(message)}`;

  useEffect(() => {
    const onKeyDown = (event) => { if (event.key === 'Escape') close(); };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = previousOverflow; };
  }, [close]);

  const submitLead = async (event) => {
    event.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    try {
      const form = new FormData(event.currentTarget);
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, preferredChannel, messengerHandle, homes: addresses, consent, website: form.get('website') }),
      });
      if (response.status === 400) {
        setStatus('invalid');
        return;
      }
      if (!response.ok) throw new Error('Could not save lead');
      setStatus('success');
    } catch {
      setStatus('error');
    }
  };

  return <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) close(); }}><div aria-labelledby="modal-title" aria-modal="true" className="lead-modal" role="dialog"><button aria-label="Закрыть" className="modal-close" onClick={close} type="button"><Icon name="close" /></button><span className="eyebrow modal-kicker">ЗАПИСЬ НА ПРОСМОТР</span>
    {status === 'success' ? <div aria-live="polite" className="lead-success"><span className="lead-success-mark"><Icon name="check" size={26} /></span><h2 id="modal-title">Заявка<br /><em>отправлена.</em></h2><p>Спасибо! Мы получили ваш номер и предпочтение по связи. {HAS_HOMES ? `Свяжемся с вами, чтобы согласовать просмотр${addresses.length ? `: ${addressText}` : '.'}` : 'Свяжемся с вами и расскажем о новых домах.'}</p><button className="button button-forest modal-button" onClick={close} type="button">Вернуться на сайт</button></div> : <>
      <h2 id="modal-title">{HAS_HOMES ? <>Давайте покажем<br /><em>вам дом.</em></> : <>Расскажем о<br /><em>новых домах.</em></>}</h2><p>{addresses.length ? <>Вы выбрали <strong>{addressText}</strong>. </> : HAS_HOMES ? <>Вы хотите посмотреть дома на Казачьей. </> : <>Вы хотите узнать о новых адресах на Казачьей. </>}Оставьте номер и выберите, как с вами удобнее связаться.</p>
      <form className="lead-form" onSubmit={submitLead}>
        <label className="lead-field">Как к вам обращаться <span>необязательно</span><input autoComplete="name" maxLength={80} onChange={(event) => setName(event.target.value)} placeholder="Ваше имя" type="text" value={name} /></label>
        <label className="lead-field">Номер телефона <span>обязательно</span><input autoComplete="tel" inputMode="tel" maxLength={30} onChange={(event) => setPhone(event.target.value)} placeholder="+7 900 000-00-00" required type="tel" value={phone} /></label>
        <fieldset className="contact-choice"><legend>Как вам ответить?</legend><div className="contact-options">{[['whatsapp', 'WhatsApp'], ['telegram', 'Telegram'], ['max', 'MAX'], ['call', 'Позвонить']].map(([value, label]) => <label className={preferredChannel === value ? 'is-selected' : ''} key={value}><input checked={preferredChannel === value} name="preferredChannel" onChange={() => setPreferredChannel(value)} required type="radio" value={value} /><span>{label}</span></label>)}</div></fieldset>
        {(preferredChannel === 'telegram' || preferredChannel === 'max') && <label className="lead-field">Имя пользователя или ссылка <span>если номер скрыт</span><input maxLength={100} onChange={(event) => setMessengerHandle(event.target.value)} placeholder="Можно оставить пустым" type="text" value={messengerHandle} /></label>}
        <label className="lead-consent"><input checked={consent} onChange={(event) => setConsent(event.target.checked)} required type="checkbox" /><span>Согласен(на) оставить свои контактные данные, чтобы со мной связались по поводу просмотра дома.</span></label>
        <label aria-hidden="true" className="lead-honeypot">Сайт<input autoComplete="off" name="website" tabIndex={-1} type="text" /></label>
        {status === 'invalid' && <p aria-live="assertive" className="lead-error">Проверьте номер телефона и выбранный способ связи.</p>}
        {status === 'error' && <p aria-live="assertive" className="lead-error">Заявка не отправилась. Данные остались в форме — попробуйте ещё раз или позвоните нам.</p>}
        <button className="button button-forest modal-button" disabled={status === 'sending'} type="submit">{status === 'sending' ? 'Отправляем…' : 'Отправить заявку'} <Icon name="arrow" size={16} /></button>
      </form>
      <div className="lead-direct"><span>Удобнее сразу связаться с нами?</span><a href={`tel:+${MANAGER_PHONE_DIGITS}`}>Позвонить: {MANAGER_PHONE}</a><a href={whatsappUrl} rel="noreferrer" target="_blank">Написать в WhatsApp <Icon name="arrow" size={14} /></a></div>
    </>}
  </div></div>;
}

export default function ZapovednyHome() {
  const [activeHome, setActiveHome] = useState(HOMES.find((home) => home.id === '8/1')?.id ?? HOMES[0]?.id ?? null);
  const [hasChosenHome, setHasChosenHome] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const [selectedHomes, setSelectedHomes] = useState([]);
  const selectHome = (home) => { setActiveHome(home); setHasChosenHome(true); };
  const openLead = (homes) => { setSelectedHomes(Array.isArray(homes) ? homes : hasChosenHome ? [activeHome] : []); setLeadOpen(true); };

  return <><Head><title>{HAS_HOMES ? 'Заповедный в Коларово — готовые дуплексы от 8 млн ₽' : 'Заповедный в Коларово — новые дома на Казачьей'}</title><meta content={HAS_HOMES ? 'Готовый кирпичный дуплекс около 170 м² на улице Казачьей в Коларово. Участок от 5,5 соток, планы этажей, фото домов и запись на просмотр.' : 'Заповедный в Коларово. Оставьте контакт, чтобы узнать о следующей очереди домов на улице Казачьей.'} name="description" /><meta content="width=device-width, initial-scale=1" name="viewport" /><meta content="#18392c" name="theme-color" /><link as="image" href="/images/kazachya-aerial.webp" rel="preload" /></Head><Header openLead={openLead} /><main><Hero openLead={openLead} /><HomeFacts openLead={openLead} /><HomesSection activeHome={activeHome} openLead={openLead} setActiveHome={selectHome} />{HAS_HOMES && <Calculator openLead={openLead} />}</main><Footer /><div className="mobile-actions"><a className="mobile-call" href={`tel:+${MANAGER_PHONE_DIGITS}`}><Icon name="phone" size={18} />Позвонить</a><button className="mobile-viewing-cta" onClick={() => openLead()}>{HAS_HOMES ? 'Записаться на просмотр' : 'Узнать о домах'} <Icon name="arrow" size={17} /></button></div>{leadOpen && <LeadModal selectedHomes={selectedHomes} close={() => setLeadOpen(false)} />}</>;
}
