import asyncio

from starlette.requests import Request
from starlette.responses import JSONResponse

import main


def test_set_security_headers_adds_expected_headers():
    scope = {
        'type': 'http',
        'http_version': '1.1',
        'method': 'GET',
        'path': '/api/daily-deck',
        'raw_path': b'/api/daily-deck',
        'query_string': b'',
        'headers': [],
        'client': ('testclient', 123),
        'server': ('testserver', 80),
        'scheme': 'http',
    }

    request = Request(scope)

    async def call_next(_request):
        response = JSONResponse({'ok': True})
        response.headers['Server'] = 'uvicorn'
        response.headers['Via'] = 'proxy'
        return response

    response = asyncio.run(main.set_security_headers(request, call_next))

    assert response.headers['x-content-type-options'] == 'nosniff'
    assert response.headers['x-frame-options'] == 'DENY'
    assert 'strict-transport-security' in response.headers
    assert 'server' not in response.headers
    assert 'via' not in response.headers
