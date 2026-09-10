<script setup>
import ToastContainer from './components/common/ToastContainer.vue';
</script>

<template>
  <div id="smartstore-app">
    <router-view />
    <ToastContainer />
  </div>
</template>

<style>
#smartstore-app {
  min-height: 100vh;
}
</style>
