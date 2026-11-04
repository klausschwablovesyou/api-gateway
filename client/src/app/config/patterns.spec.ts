import { IP_PATTERN, IPV4_PATTERN, IPV6_PATTERN, URL_PATTERN } from './patterns';

describe('patterns', () => {
  describe('IPV4_PATTERN', () => {
    for (const value of ['0.0.0.0', '1.2.3.4', '192.168.1.255', '255.255.255.255']) {
      it(`should accept ${value}`, () => expect(IPV4_PATTERN.test(value)).toBeTrue());
    }

    for (const value of ['', '256.1.1.1', '1.2.3', '1.2.3.4.5', '1.2.3.a', ' 1.2.3.4', '1.2.3.4/32']) {
      it(`should reject "${value}"`, () => expect(IPV4_PATTERN.test(value)).toBeFalse());
    }
  });

  describe('IPV6_PATTERN', () => {
    const valid = [
      '2001:0db8:85a3:0000:0000:8a2e:0370:7334',
      '::1',
      '2001:db8::',
      '2001:db8::1',
      'fe80::1',
      'fe80::1:2',
      '1:2:3::4:5:6',
      '1::2:3:4:5:6:7',
      '1:2:3:4:5:6::7',
    ];

    for (const value of valid) {
      it(`should accept ${value}`, () => expect(IPV6_PATTERN.test(value)).toBeTrue());
    }

    const invalid = [
      '',
      '1.2.3.4',
      '12345::',
      'gggg::1',
      '1:2:3:4:5:6:7:8:9',
      '1::2::3',
      '1:2:3:4::5:6:7:8',
      '1:2:3:4:5:6:7::8',
    ];

    for (const value of invalid) {
      it(`should reject "${value}"`, () => expect(IPV6_PATTERN.test(value)).toBeFalse());
    }
  });

  describe('IP_PATTERN', () => {
    it('should accept both address families', () => {
      expect(IP_PATTERN.test('1.2.3.4')).toBeTrue();
      expect(IP_PATTERN.test('::1')).toBeTrue();
    });

    it('should reject anything else', () => {
      for (const value of ['', 'localhost', '999.1.1.1', 'text 1.2.3.4']) {
        expect(IP_PATTERN.test(value)).toBeFalse();
      }
    });
  });

  describe('URL_PATTERN', () => {
    const valid = [
      'http://example.com',
      'https://example.com',
      'https://sub.example.com/path',
      'http://localhost:3000',
      'https://example.com/v1/{city}?units=metric#top',
    ];

    for (const value of valid) {
      it(`should accept ${value}`, () => expect(URL_PATTERN.test(value)).toBeTrue());
    }

    const invalid = ['', 'example.com', 'ftp://example.com', 'https://', 'https://exa mple.com', 'https://example.com/a b'];

    for (const value of invalid) {
      it(`should reject "${value}"`, () => expect(URL_PATTERN.test(value)).toBeFalse());
    }
  });
});
