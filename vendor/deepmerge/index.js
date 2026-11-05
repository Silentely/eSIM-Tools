var defaultIsMergeableObject = function (value) {
  if (!value || typeof value !== 'object') return false
  var stringValue = Object.prototype.toString.call(value)
  if (stringValue === '[object RegExp]' || stringValue === '[object Date]') return false
  var reactElementType = typeof Symbol === 'function' && Symbol.for
    ? Symbol.for('react.element')
    : 0xeac7
  return value.$$typeof !== reactElementType
}

function emptyTarget(val) {
  return Array.isArray(val) ? [] : {}
}

function cloneUnlessOtherwiseSpecified(value, options) {
  return (options.clone !== false && options.isMergeableObject(value))
    ? deepmerge(emptyTarget(value), value, options)
    : value
}

function defaultArrayMerge(target, source, options) {
  return target.concat(source).map(function (element) {
    return cloneUnlessOtherwiseSpecified(element, options)
  })
}

function getMergeFunction(key, options) {
  if (!options.customMerge) return deepmerge
  var customMerge = options.customMerge(key)
  return typeof customMerge === 'function' ? customMerge : deepmerge
}

function getEnumerableOwnPropertySymbols(target) {
  return Object.getOwnPropertySymbols
    ? Object.getOwnPropertySymbols(target).filter(function (symbol) {
      return Object.propertyIsEnumerable.call(target, symbol)
    })
    : []
}

function getKeys(target) {
  return Object.keys(target).concat(getEnumerableOwnPropertySymbols(target))
}

function propertyIsOnObject(object, property) {
  try {
    return property in object
  } catch (_) {
    return false
  }
}

// Protects from prototype poisoning and unexpected merging up the prototype chain.
function propertyIsUnsafe(target, key) {
  return propertyIsOnObject(target, key) &&
    !(Object.hasOwnProperty.call(target, key) && Object.propertyIsEnumerable.call(target, key))
}

function mergeObject(target, source, options) {
  var destination = {}
  if (options.isMergeableObject(target)) {
    getKeys(target).forEach(function (key) {
      destination[key] = cloneUnlessOtherwiseSpecified(target[key], options)
    })
  }
  getKeys(source).forEach(function (key) {
    if (propertyIsUnsafe(target, key)) return

    if (propertyIsOnObject(target, key) && options.isMergeableObject(source[key])) {
      destination[key] = getMergeFunction(key, options)(target[key], source[key], options)
    } else {
      destination[key] = cloneUnlessOtherwiseSpecified(source[key], options)
    }
  })
  return destination
}

function deepmerge(target, source, options) {
  options = options || {}
  options.arrayMerge = options.arrayMerge || defaultArrayMerge
  options.isMergeableObject = options.isMergeableObject || defaultIsMergeableObject
  options.cloneUnlessOtherwiseSpecified = cloneUnlessOtherwiseSpecified

  var sourceIsArray = Array.isArray(source)
  var targetIsArray = Array.isArray(target)
  if (sourceIsArray !== targetIsArray) return cloneUnlessOtherwiseSpecified(source, options)
  if (sourceIsArray) return options.arrayMerge(target, source, options)
  return mergeObject(target, source, options)
}

deepmerge.all = function deepmergeAll(array, options) {
  if (!Array.isArray(array)) throw new Error('first argument should be an array')
  return array.reduce(function (prev, next) {
    return deepmerge(prev, next, options)
  }, {})
}

module.exports = deepmerge
