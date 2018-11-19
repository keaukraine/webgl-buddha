requirejs.config({
    'baseUrl': 'js/app',
    'paths': {
      'app': '../app'
    }
});

requirejs(['app/main']);
